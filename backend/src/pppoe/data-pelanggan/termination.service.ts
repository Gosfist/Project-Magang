import { localBillingDate, serviceInvoiceNumber } from './billing-cycle.js';
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
    CancelTerminationDto,
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
                terminations: {
                    none: { status: { in: ['PENDING', 'COMPLETED'] } },
                },
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
        const result = await this.prisma
            .$transaction(
                async (tx) => {
                    await tx.$queryRaw`SELECT id FROM daftar_pelanggan WHERE id = ${this.id(dto.accountId)} FOR UPDATE`;
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
                    // A previous cancellation may have restored an unpaid full-month invoice.
                    const adjusted = await this.adjustResumedInvoices(
                        tx,
                        current.id,
                        now,
                        billing.billingTimezone,
                    );
                    // Freeze all unbilled service periods when admin adds the termination.
                    const quote = await this.quote(
                        tx,
                        row.id,
                        billing.billingTimezone,
                    );
                    const materialized = await this.materialize(tx, quote, now);
                    const promises = await tx.paymentPromise.findMany({
                        where: {
                            pppoeAccountId: current.id,
                            status: { in: ['ACTIVE', 'EXPIRED'] },
                        },
                        select: {
                            id: true,
                            status: true,
                            deadline: true,
                            disconnectPending: true,
                        },
                    });
                    await tx.appSetting.upsert({
                        where: { key: `termination_original_${row.id}` },
                        create: {
                            key: `termination_original_${row.id}`,
                            value: JSON.stringify({
                                isActive: current.isActive,
                                expiresAt: current.expiresAt,
                                promises: promises.map((promise) => ({
                                    ...promise,
                                    id: String(promise.id),
                                })),
                                createdInvoiceIds: [
                                    ...adjusted,
                                    ...materialized
                                        .filter(
                                            (invoice) =>
                                                !quote.unpaid.some(
                                                    (old) =>
                                                        old.id === invoice.id,
                                                ),
                                        )
                                        .map((invoice) => String(invoice.id)),
                                ],
                            }),
                        },
                        update: {},
                    });
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
                    return {
                        account: stopped,
                        approval: this.approvalPayload(
                            quote,
                            billing.billingTimezone,
                        ),
                    };
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
        let notified = false;
        try {
            notified = await this.wa.notifyTerminationApproved(result.approval);
        } catch {
            /* The termination remains saved if the bot fails. */
        }
        if (!notified)
            warnings.push(
                'WhatsApp persetujuan belum terkirim. Gunakan Kirim WA pada daftar Belum diambil.',
            );
        return {
            message: `Langganan dan penagihan dihentikan sejak permintaan ini disimpan. Menunggu pengambilan perangkat.${warnings.length ? ' ' + warnings.join(' ') : ''}`,
            warnings,
            whatsappNotified: notified,
        };
    }
    private periodInvoices(
        invoices: Prisma.InvoiceGetPayload<{ include: { deposits: true } }>[],
        period: { invoiceNumber: string; from: string },
    ) {
        return invoices.filter(
            (invoice) =>
                invoice.status !== 'CANCELLED' &&
                (invoice.invoiceNumber === period.invoiceNumber ||
                    (invoice.invoiceNumber.startsWith('RESUME-') &&
                        invoice.notes?.includes(`: ${period.from} s.d.`))),
        );
    }
    private async adjustResumedInvoices(
        tx: Prisma.TransactionClient,
        accountId: bigint,
        cutoff: Date,
        timezone: 'WIB' | 'WITA' | 'WIT',
    ) {
        const account = await tx.pppoeAccount.findUniqueOrThrow({
            where: { id: accountId },
            include: { package: true },
        });
        const periods = terminationPeriods(account, cutoff, timezone);
        const invoices = await tx.invoice.findMany({
            where: { pppoeAccountId: accountId },
            include: { deposits: true },
        });
        const adjusted = new Set<string>();
        for (const period of periods) {
            const group = this.periodInvoices(invoices, period);
            if (
                !group.some((invoice) =>
                    invoice.notes?.startsWith(
                        'Langganan normal setelah pembatalan penghentian',
                    ),
                )
            )
                continue;
            const paid = group.filter(
                (invoice) => invoice.paidAt || invoice.status === 'PAID',
            );
            const unpaid = group.filter((invoice) => !paid.includes(invoice));
            const reserved = (invoice: (typeof group)[number]) =>
                invoice.deposits
                    .filter((deposit) =>
                        ['PENDING', 'ACCEPTED'].includes(deposit.status),
                    )
                    .reduce((sum, deposit) => sum + Number(deposit.amount), 0);
            const remainder = Math.max(
                0,
                period.amount -
                    paid.reduce(
                        (sum, invoice) => sum + Number(invoice.amount),
                        0,
                    ) -
                    unpaid.reduce((sum, invoice) => sum + reserved(invoice), 0),
            );
            const primary =
                unpaid.find(
                    (invoice) => invoice.invoiceNumber === period.invoiceNumber,
                ) ?? unpaid[0];
            for (const invoice of unpaid) {
                const amount =
                    reserved(invoice) + (invoice === primary ? remainder : 0);
                if (!Number.isSafeInteger(amount))
                    throw new BadRequestException(
                        'Nominal tagihan di luar batas.',
                    );
                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        amount: BigInt(amount),
                        baseAmount: BigInt(amount),
                        dueDate: cutoff,
                        status: amount ? 'PENDING' : 'PAID',
                        paidAt: amount ? null : cutoff,
                        updatedAt: cutoff,
                        notes: `Pelunasan berhenti langganan: ${period.from} s.d. ${period.through}`,
                    },
                });
            }
            for (const invoice of group) adjusted.add(String(invoice.id));
        }
        return [...adjusted];
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
            throw new ConflictException(
                'Permintaan sudah selesai atau dibatalkan.',
            );
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
    private approvalPayload(
        quote: Awaited<ReturnType<TerminationService['quote']>>,
        timezone: 'WIB' | 'WITA' | 'WIT',
    ) {
        const cutoff = quote.row.account.terminatedAt ?? quote.row.requestedAt;
        const local = localBillingDate(cutoff, timezone);
        const number = serviceInvoiceNumber(
            local.getUTCFullYear(),
            local.getUTCMonth() + 1,
            quote.row.account.customerNumber,
        );
        const prorateAmount = [...quote.unpaid, ...quote.planned]
            .filter((invoice) => invoice.invoiceNumber === number)
            .reduce((sum, invoice) => sum + invoice.amount, 0);
        return {
            customerName: quote.row.account.customerName,
            customerNumber: quote.row.account.customerNumber,
            phone: quote.row.account.phone,
            packageName: quote.row.account.package.name,
            terminationDate: new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'long',
                timeZone: 'UTC',
            }).format(local),
            prorateAmount,
            otherAmount: quote.total - prorateAmount,
            totalAmount: quote.total,
        };
    }
    async notifyApproval(id: string) {
        const billing = await this.settings.billing();
        const payload = await this.prisma.$transaction(
            async (tx) =>
                this.approvalPayload(
                    await this.quote(tx, this.id(id), billing.billingTimezone),
                    billing.billingTimezone,
                ),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        const sent = await this.wa.notifyTerminationApproved(payload);
        if (!sent)
            throw new BadRequestException(
                'WhatsApp persetujuan belum terkirim. Periksa koneksi bot.',
            );
        return { message: 'WhatsApp persetujuan berhenti langganan terkirim.' };
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
    async cancel(id: string, dto: CancelTerminationDto, userId: string) {
        const billing = await this.settings.billing();
        const now = new Date();
        const restored = await this.prisma
            .$transaction(
                async (tx) => {
                    const row = await tx.subscriptionTermination.findUnique({
                        where: { id: this.id(id) },
                        include: {
                            account: {
                                include: {
                                    package: { include: { ipPool: true } },
                                },
                            },
                        },
                    });
                    if (!row)
                        throw new NotFoundException(
                            'Permintaan berhenti langganan tidak ditemukan.',
                        );
                    if (row.status !== 'PENDING')
                        throw new ConflictException(
                            'Hanya permintaan yang perangkatnya belum diambil yang dapat dibatalkan.',
                        );
                    const claimed = await tx.subscriptionTermination.updateMany(
                        {
                            where: { id: row.id, status: 'PENDING' },
                            data: { status: 'CANCELLED' },
                        },
                    );
                    if (!claimed.count)
                        throw new ConflictException(
                            'Status permintaan telah berubah. Muat ulang daftar.',
                        );
                    const user = await tx.user.findUniqueOrThrow({
                        where: { id: this.id(userId) },
                    });
                    const snapshot = await tx.appSetting.findUnique({
                        where: { key: `termination_original_${row.id}` },
                    });
                    const original = snapshot
                        ? (JSON.parse(snapshot.value) as {
                              isActive: boolean;
                              expiresAt: string | null;
                              createdInvoiceIds: string[];
                              promises?: {
                                  id: string;
                                  status: string;
                                  deadline: string;
                                  disconnectPending: boolean;
                              }[];
                          })
                        : null;
                    await this.restoreNormalInvoices(
                        tx,
                        row.account,
                        row.requestedAt,
                        original?.createdInvoiceIds,
                        now,
                        billing.billingTimezone,
                        billing.billingEndDay,
                        row.id,
                    );
                    let promiseExpired = false;
                    for (const promise of original?.promises ?? []) {
                        const expired = new Date(promise.deadline) <= now;
                        promiseExpired ||= expired;
                        await tx.paymentPromise.updateMany({
                            where: {
                                id: this.id(promise.id),
                                pppoeAccountId: row.pppoeAccountId,
                                status: 'CANCELLED',
                            },
                            data: {
                                status: expired ? 'EXPIRED' : promise.status,
                                disconnectPending:
                                    expired || promise.disconnectPending,
                            },
                        });
                    }
                    const account = await tx.pppoeAccount.update({
                        where: { id: row.pppoeAccountId },
                        data: {
                            terminatedAt: null,
                            isActive:
                                !promiseExpired && (original?.isActive ?? true),
                            expiresAt: original
                                ? original.expiresAt
                                    ? new Date(original.expiresAt)
                                    : null
                                : row.account.expiresAt,
                            updatedAt: now,
                        },
                        include: { package: { include: { ipPool: true } } },
                    });
                    await this.radius.sync(tx, account);
                    await tx.appSetting.upsert({
                        where: { key: `termination_cancel_${row.id}` },
                        create: {
                            key: `termination_cancel_${row.id}`,
                            value: JSON.stringify({
                                cancelledAt: now,
                                cancelledByUserId: String(user.id),
                                cancelledByName: user.name,
                                reason: dto.reason.trim(),
                            }),
                        },
                        update: {},
                    });
                    await tx.activityLog.create({
                        data: {
                            userName: user.name,
                            role: 'admin',
                            module: 'Berhenti Langganan',
                            action: 'CANCEL',
                            status: 'SUCCESS',
                            entityType: 'TERMINATION',
                            entityId: String(row.id),
                            description:
                                `Pembatalan penghentian pelanggan ${account.customerNumber}: ${dto.reason.trim()}`.slice(
                                    0,
                                    500,
                                ),
                        },
                    });
                    return account;
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
                        'Data berubah bersamaan dengan petugas lain. Muat ulang daftar.',
                    );
                throw error;
            });
        const warnings: string[] = [];
        try {
            warnings.push(
                ...(
                    await this.network.disconnect(
                        restored.username,
                        restored.routerNasId,
                    )
                ).warnings,
            );
        } catch {
            warnings.push(
                'Pembaruan sesi RADIUS belum berhasil. Periksa sesi pelanggan.',
            );
        }
        return {
            message: `Permintaan berhenti langganan dibatalkan. Langganan dan penagihan normal dipulihkan; status isolir sebelumnya tetap berlaku.${warnings.length ? ' ' + warnings.join(' ') : ''}`,
            warnings,
        };
    }
    private async restoreNormalInvoices(
        tx: Prisma.TransactionClient,
        account: Awaited<
            ReturnType<TerminationService['quote']>
        >['row']['account'],
        requestedAt: Date,
        createdIds: string[] | undefined,
        now: Date,
        timezone: 'WIB' | 'WITA' | 'WIT',
        endDay: number,
        requestId: bigint,
    ) {
        const local = localBillingDate(now, timezone);
        const monthEnd = new Date(
            Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0, 12),
        );
        const periods = terminationPeriods(account, monthEnd, timezone);
        const invoices = await tx.invoice.findMany({
            where: { pppoeAccountId: account.id },
            include: { deposits: true },
        });
        for (const period of periods) {
            if (!Number.isSafeInteger(period.amount))
                throw new BadRequestException('Nominal tagihan di luar batas.');
            const group = this.periodInvoices(invoices, period);
            const invoice = invoices.find(
                (item) => item.invoiceNumber === period.invoiceNumber,
            );
            const generated =
                invoice &&
                (createdIds
                    ? createdIds.includes(String(invoice.id))
                    : invoice.notes?.startsWith(
                          'Pelunasan berhenti langganan:',
                      ) &&
                      (!invoice.createdAt || invoice.createdAt >= requestedAt));
            if (invoice && !generated) continue;
            const month = new Date(`${period.from}T00:00:00Z`);
            const nextDays = new Date(
                Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 2, 0),
            ).getUTCDate();
            const dueDate = new Date(
                Date.UTC(
                    month.getUTCFullYear(),
                    month.getUTCMonth() + 1,
                    Math.min(endDay, nextDays),
                ),
            );
            const data = {
                amount: BigInt(period.amount),
                baseAmount: BigInt(period.amount),
                invoiceType: period.from.endsWith('-01')
                    ? 'MONTHLY'
                    : 'PRORATE',
                dueDate,
                status: period.amount ? 'PENDING' : 'PAID',
                paidAt: period.amount ? null : now,
                updatedAt: now,
                notes: `Langganan normal setelah pembatalan penghentian #${requestId}: ${period.from} s.d. ${period.through}`,
            };
            if (!invoice) {
                await tx.invoice.create({
                    data: {
                        ...data,
                        pppoeAccountId: account.id,
                        invoiceNumber: period.invoiceNumber,
                        createdAt: now,
                    },
                });
            } else if (
                invoice.paidAt ||
                invoice.status === 'PAID' ||
                invoice.deposits.length
            ) {
                const difference =
                    period.amount -
                    group.reduce((sum, item) => sum + Number(item.amount), 0);
                if (difference > 0)
                    await tx.invoice.create({
                        data: {
                            ...data,
                            pppoeAccountId: account.id,
                            invoiceNumber: `RESUME-${requestId}-${invoice.id}`,
                            invoiceType: 'ADDON',
                            amount: BigInt(difference),
                            baseAmount: BigInt(difference),
                            status: 'PENDING',
                            paidAt: null,
                            createdAt: now,
                        },
                    });
            } else {
                const amount = Math.max(
                    0,
                    period.amount -
                        group
                            .filter((item) => item.id !== invoice.id)
                            .reduce(
                                (sum, item) => sum + Number(item.amount),
                                0,
                            ),
                );
                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        ...data,
                        amount: BigInt(amount),
                        baseAmount: BigInt(amount),
                        status: amount ? 'PENDING' : 'PAID',
                        paidAt: amount ? null : now,
                    },
                });
            }
        }
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
