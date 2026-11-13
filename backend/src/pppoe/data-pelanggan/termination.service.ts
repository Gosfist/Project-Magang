import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { serialize, pageMeta } from '../../common/serialize.js';
import { customerSearch } from '../../common/customer-search.js';
import { RadiusService } from '../shared/radius.service.js';
import { PppoeNetworkService } from '../shared/pppoe-network.service.js';
import { PengaturanService } from '../../tools/pengaturan/pengaturan.service.js';
import { WhatsappNotifyService } from '../../bot-whatsapp/shared/whatsapp-notify.service.js';
import {
    CreateTerminationDto,
    CompleteTerminationDto,
} from './termination.dto.js';
import { terminationPeriods } from './termination-billing.js';

@Injectable()
export class TerminationService {
    constructor(
        private prisma: PrismaService,
        private radius: RadiusService,
        private network: PppoeNetworkService,
        private settings: PengaturanService,
        private wa: WhatsappNotifyService,
    ) {}
    private id(value: string) {
        if (!/^[1-9]\d{0,18}$/.test(value))
            throw new BadRequestException('ID tidak valid.');
        return BigInt(value);
    }
    async list(search = '', status = 'PENDING', page = 1) {
        if (!['PENDING', 'COMPLETED'].includes(status))
            throw new BadRequestException('Filter pengambilan tidak valid.');
        const where: Prisma.SubscriptionTerminationWhereInput = {
            status,
            ...(search ? { account: customerSearch(search) } : {}),
        };
        const [rows, count] = await this.prisma.$transaction([
            this.prisma.subscriptionTermination.findMany({
                where,
                include: {
                    account: {
                        select: {
                            customerName: true,
                            customerNumber: true,
                            address: true,
                            phone: true,
                            package: { select: { name: true } },
                        },
                    },
                },
                orderBy: { requestedAt: 'desc' },
                take: 10,
                skip: (page - 1) * 10,
            }),
            this.prisma.subscriptionTermination.count({ where }),
        ]);
        return serialize({ data: rows, meta: pageMeta(page, 10, count) });
    }
    async options(search: string) {
        if (!search.trim()) return { data: [] };
        const rows = await this.prisma.pppoeAccount.findMany({
            where: {
                ...customerSearch(search),
                terminatedAt: null,
                termination: { is: null },
            },
            select: {
                id: true,
                customerNumber: true,
                customerName: true,
                address: true,
            },
            take: 20,
            orderBy: { customerNumber: 'asc' },
        });
        return serialize({ data: rows });
    }
    async create(dto: CreateTerminationDto, userId: string) {
        const billing = await this.settings.billing();
        const now = new Date();
        const account = await this.prisma
            .$transaction(
                async (tx) => {
                    const current = await tx.pppoeAccount.findUnique({
                        where: { id: this.id(dto.accountId) },
                    });
                    if (!current || current.terminatedAt)
                        throw new BadRequestException(
                            'Pelanggan tidak tersedia untuk penghentian.',
                        );
                    const user = await tx.user.findUniqueOrThrow({
                        where: { id: this.id(userId) },
                    });
                    const row = await tx.subscriptionTermination.create({
                        data: {
                            pppoeAccountId: current.id,
                            requestedByUserId: user.id,
                            requestedByName: user.name,
                            reason: dto.reason.trim(),
                            requestedAt: now,
                        },
                    });
                    // Freeze all unbilled service periods when admin adds the termination.
                    const quote = await this.quote(
                        tx,
                        row.id,
                        billing.billingTimezone,
                    );
                    await this.materialize(tx, quote, now);
                    await tx.paymentPromise.updateMany({
                        where: {
                            pppoeAccountId: current.id,
                            status: { in: ['ACTIVE', 'EXPIRED'] },
                        },
                        data: { status: 'CANCELLED', disconnectPending: false },
                    });
                    const stopped = await tx.pppoeAccount.update({
                        where: { id: current.id },
                        data: {
                            terminatedAt: now,
                            isActive: false,
                            updatedAt: now,
                        },
                        include: { package: { include: { ipPool: true } } },
                    });
                    await this.radius.sync(tx, stopped);
                    return stopped;
                },
                {
                    isolationLevel:
                        Prisma.TransactionIsolationLevel.Serializable,
                    timeout: 20000,
                },
            )
            .catch((error) => {
                if (
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    ['P2002', 'P2034'].includes(error.code)
                )
                    throw new ConflictException(
                        'Data pelanggan berubah atau sudah masuk daftar berhenti langganan. Muat ulang daftar.',
                    );
                throw error;
            });
        const warnings: string[] = [];
        try {
            warnings.push(
                ...(
                    await this.network.disconnect(
                        account.username,
                        account.routerNasId,
                    )
                ).warnings,
            );
        } catch {
            warnings.push(
                'Pemutusan sesi RADIUS belum berhasil. Periksa status sesi.',
            );
        }
        return {
            message: `Langganan dan penagihan dihentikan sejak permintaan ini disimpan. Menunggu pengambilan perangkat.${warnings.length ? ' ' + warnings.join(' ') : ''}`,
            warnings,
        };
    }
    private async quote(
        tx: Prisma.TransactionClient,
        id: bigint,
        timezone: 'WIB' | 'WITA' | 'WIT',
    ) {
        const row = await tx.subscriptionTermination.findUnique({
            where: { id },
            include: { account: { include: { package: true } } },
        });
        if (!row) throw new NotFoundException('Permintaan tidak ditemukan.');
        if (row.status !== 'PENDING')
            throw new ConflictException('Pengambilan sudah selesai.');
        const invoices = await tx.invoice.findMany({
            where: { pppoeAccountId: row.pppoeAccountId },
            include: {
                deposits: {
                    where: { status: { in: ['PENDING', 'ACCEPTED'] } },
                    select: { amount: true },
                },
            },
        });
        const planned = terminationPeriods(
            row.account,
            row.account.terminatedAt ?? row.requestedAt,
            timezone,
        ).filter(
            (period) =>
                !invoices.some(
                    (invoice) => invoice.invoiceNumber === period.invoiceNumber,
                ),
        );
        const unpaid = invoices
            .filter((invoice) =>
                ['PENDING', 'OVERDUE'].includes(invoice.status),
            )
            .map((invoice) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: Math.max(
                    0,
                    Number(invoice.amount) -
                        invoice.deposits.reduce(
                            (sum, deposit) => sum + Number(deposit.amount),
                            0,
                        ),
                ),
            }));
        const total = [...unpaid, ...planned].reduce(
            (sum, invoice) => sum + invoice.amount,
            0,
        );
        if (!Number.isSafeInteger(total))
            throw new BadRequestException(
                'Total tagihan di luar batas nominal.',
            );
        return { row, planned, unpaid, total };
    }
    private async materialize(
        tx: Prisma.TransactionClient,
        quote: Awaited<ReturnType<TerminationService['quote']>>,
        now: Date,
    ) {
        const unpaid = [...quote.unpaid];
        for (const planned of quote.planned) {
            const invoice = await tx.invoice.create({
                data: {
                    pppoeAccountId: quote.row.pppoeAccountId,
                    invoiceNumber: planned.invoiceNumber,
                    amount: BigInt(planned.amount),
                    baseAmount: BigInt(planned.amount),
                    invoiceType: 'PRORATE',
                    status: planned.amount ? 'PENDING' : 'PAID',
                    paidAt: planned.amount ? null : now,
                    dueDate: now,
                    notes: `Pelunasan berhenti langganan: ${planned.from} s.d. ${planned.through}`,
                    createdAt: now,
                    updatedAt: now,
                },
            });
            unpaid.push({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: planned.amount,
            });
        }
        return unpaid;
    }
    async summary(id: string) {
        const billing = await this.settings.billing();
        const result = await this.prisma.$transaction(
            (tx) => this.quote(tx, this.id(id), billing.billingTimezone),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return serialize({
            total: result.total,
            invoices: [...result.unpaid, ...result.planned],
            customerName: result.row.account.customerName,
        });
    }
    async complete(id: string, dto: CompleteTerminationDto, userId: string) {
        const billing = await this.settings.billing();
        const now = new Date();
        const result = await this.prisma
            .$transaction(
                async (tx) => {
                    const quote = await this.quote(
                        tx,
                        this.id(id),
                        billing.billingTimezone,
                    );
                    if (dto.amount !== quote.total)
                        throw new ConflictException(
                            'Tagihan berubah. Buka ulang ringkasan pembayaran sebelum menyelesaikan.',
                        );
                    const user = await tx.user.findUniqueOrThrow({
                        where: { id: this.id(userId) },
                    });
                    const claimed = await tx.subscriptionTermination.updateMany(
                        {
                            where: { id: quote.row.id, status: 'PENDING' },
                            data: {
                                status: 'COMPLETED',
                                completedAt: now,
                                collectedByUserId: user.id,
                                collectedByName: user.name,
                                collectedAmount: BigInt(quote.total),
                            },
                        },
                    );
                    if (!claimed.count)
                        throw new ConflictException(
                            'Pengambilan sudah diselesaikan petugas lain.',
                        );
                    const unpaid = await this.materialize(tx, quote, now);
                    for (const invoice of unpaid.filter(
                        (invoice) => invoice.amount > 0,
                    )) {
                        await tx.collectorDeposit.create({
                            data: {
                                pppoeAccountId: quote.row.pppoeAccountId,
                                invoiceId: invoice.id,
                                collectorUserId: user.id,
                                amount: BigInt(invoice.amount),
                                depositDate: now,
                                notes: `Pengambilan perangkat / berhenti langganan oleh ${user.name}. Menunggu ACC finance.`,
                            },
                        });
                    }
                    await tx.paymentPromise.updateMany({
                        where: {
                            pppoeAccountId: quote.row.pppoeAccountId,
                            status: { in: ['ACTIVE', 'EXPIRED'] },
                        },
                        data: { status: 'CANCELLED', disconnectPending: false },
                    });
                    const account = await tx.pppoeAccount.update({
                        where: { id: quote.row.pppoeAccountId },
                        data: {
                            terminatedAt:
                                quote.row.account.terminatedAt ??
                                quote.row.requestedAt,
                            isActive: false,
                            odpPort: null,
                            updatedAt: now,
                        },
                        include: { package: { include: { ipPool: true } } },
                    });
                    await this.radius.sync(tx, account);
                    return { account, name: user.name };
                },
                {
                    isolationLevel:
                        Prisma.TransactionIsolationLevel.Serializable,
                    timeout: 20000,
                },
            )
            .catch((error) => {
                if (
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    ['P2034', 'P2002'].includes(error.code)
                )
                    throw new ConflictException(
                        'Data berubah bersamaan dengan petugas lain. Muat ulang ringkasan.',
                    );
                throw error;
            });
        const warnings: string[] = [];
        try {
            warnings.push(
                ...(
                    await this.network.disconnect(
                        result.account.username,
                        result.account.routerNasId,
                    )
                ).warnings,
            );
        } catch {
            warnings.push(
                'Pemutusan sesi RADIUS belum berhasil. Periksa status sesi.',
            );
        }
        let sent = false;
        try {
            sent = await this.wa.notifyTermination({
                ...result.account,
                collectedByName: result.name,
                amount: dto.amount,
            });
        } catch {
            /* Completion and cash records remain committed if the bot is unavailable. */
        }
        if (sent) {
            try {
                await this.prisma.subscriptionTermination.update({
                    where: { id: this.id(id) },
                    data: { waSentAt: new Date() },
                });
            } catch {
                warnings.push(
                    'WA terkirim tetapi status pengiriman belum tersimpan. Periksa log bot sebelum mengirim ulang.',
                );
            }
        } else
            warnings.push(
                'WhatsApp belum terkirim. Gunakan Kirim ulang WA pada daftar selesai.',
            );
        return {
            message: `Perangkat sudah diambil. Tanggal berhenti langganan tetap mengikuti permintaan admin. Setoran Rp${dto.amount.toLocaleString('id-ID')} dicatat untuk ACC finance.${warnings.length ? ' ' + warnings.join(' ') : ''}`,
            warnings,
        };
    }
    async resend(id: string) {
        const row = await this.prisma.subscriptionTermination.findUnique({
            where: { id: this.id(id) },
            include: { account: true },
        });
        if (!row || row.status !== 'COMPLETED')
            throw new BadRequestException('Pengambilan belum selesai.');
        const sent = await this.wa.notifyTermination({
            ...row.account,
            collectedByName: row.collectedByName || '-',
            amount: Number(row.collectedAmount),
        });
        if (!sent)
            throw new BadRequestException(
                'WhatsApp belum terkirim. Periksa koneksi bot.',
            );
        await this.prisma.subscriptionTermination.update({
            where: { id: row.id },
            data: { waSentAt: new Date() },
        });
        return { message: 'Notifikasi WhatsApp terkirim.' };
    }
}
