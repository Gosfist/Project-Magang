import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { terminationPeriods } from './termination-billing.js';
import { TerminationService } from './termination.service.js';
import { TerminationController } from './termination.controller.js';
const account = {
    id: 7n,
    customerNumber: 7n,
    createdAt: new Date('2026-11-11T01:00:00Z'),
    customerName: 'Paijo',
    username: 'paijo',
    routerNasId: 3,
    odpPort: 2,
    phone: '08123',
    terminatedAt: null,
    isActive: true,
    manualIsolated: false,
    expiresAt: null,
    idCardNumber: '1234567890123456',
    idCardPhoto: '/uploads/ktp/kept.jpg',
    subscriptionType: 'POSTPAID',
    discount: 10000n,
    package: { name: '50 Mb', price: 310000n },
};
function setup() {
    let row: any = {
        id: 1n,
        pppoeAccountId: 7n,
        status: 'PENDING',
        requestedAt: new Date('2026-11-13T02:00:00Z'),
        account: structuredClone(account),
    };
    let invoices: any[] = [],
        deposits: any[] = [];
    let settings: Record<string, any> = {}, logs: any[] = [], history: any[] = [], sequence = 0;
    const tx = {
        $queryRaw: vi.fn(async () => []),
        appSetting: {
            findUnique: vi.fn(async ({ where }) => settings[where.key] || null),
            upsert: vi.fn(async ({ where, create, update }) => { settings[where.key] = settings[where.key] ? { ...settings[where.key], ...update } : create; return settings[where.key]; }),
        },
        activityLog: { create: vi.fn(async ({ data }) => { logs.push(data); return data; }) },
        subscriptionTermination: {
            findUnique: vi.fn(async () => row),
            create: vi.fn(async ({ data }) => { if (sequence) history.push(structuredClone(row)); row = { ...data, id: BigInt(++sequence), status: 'PENDING', account: row.account }; return row; }),
            updateMany: vi.fn(async ({ where, data }) => {
                if (row.status !== where.status) return { count: 0 };
                Object.assign(row, data);
                return { count: 1 };
            }),
            update: vi.fn(async ({ data }) => Object.assign(row, data)),
        },
        invoice: {
            update: vi.fn(async ({ where, data }) => Object.assign(invoices.find(invoice => invoice.id === where.id), data)),
            findMany: vi.fn(async () => invoices),
            create: vi.fn(async ({ data }) => {
                const invoice = {
                    id: BigInt(invoices.length + 1),
                    deposits: [],
                    ...data,
                };
                invoices.push(invoice);
                return invoice;
            }),
        },
        collectorDeposit: {
            create: vi.fn(async ({ data }) => {
                deposits.push(data);
                return data;
            }),
        },
        paymentPromise: { findMany: vi.fn(async () => [] as any[]), updateMany: vi.fn(async () => ({ count: 0 })) },
        pppoeAccount: {
            findUnique: vi.fn(async () => row.account),
            findUniqueOrThrow: vi.fn(async () => row.account),
            update: vi.fn(async ({ data }) => Object.assign(row.account, data)),
        },
        user: {
            findUniqueOrThrow: vi.fn(async () => ({
                id: 9n,
                name: 'Teknisi Budi',
            })),
        },
    };
    const prisma = {
        ...tx,
        $transaction: vi.fn(async (work) => {
            const before = structuredClone({ row, invoices, deposits, settings, logs, history });
            try {
                return await work(tx);
            } catch (error) {
                settings = before.settings; logs = before.logs; history = before.history;
                row = before.row;
                invoices = before.invoices;
                deposits = before.deposits;
                throw error;
            }
        }),
    };
    const radius = { sync: vi.fn(async () => undefined) };
    const network = {
        disconnect: vi.fn(async () => {
            expect(['PENDING', 'COMPLETED', 'CANCELLED']).toContain(row.status);
            if (row.status === 'CANCELLED') expect(row.account.terminatedAt).toBeNull();
            else expect(row.account.terminatedAt).toBeInstanceOf(Date);
            return { warnings: [] };
        }),
    };
    const wa = { notifyTermination: vi.fn(async () => true), notifyTerminationApproved: vi.fn(async () => true) };
    const service = new TerminationService(
        prisma as any,
        radius as any,
        network as any,
        { billing: async () => ({ billingTimezone: 'WIB', billingEndDay: 10 }) } as any,
        wa as any,
    );
    return {
        service,
        tx,
        prisma,
        radius,
        network,
        wa,
        state: () => ({ row, invoices, deposits, settings, logs, history }),
        invoices,
    };
}
describe('termination prorate', () => {
    it('charges only activation through the admin termination date including that day', () => {
        expect(
            terminationPeriods(
                account as any,
                new Date('2026-11-13T02:00:00Z'),
                'WIB',
            ),
        ).toEqual([
            {
                invoiceNumber: 'INV/202611/0000007',
                amount: 30000,
                from: '2026-11-11',
                through: '2026-11-13',
            },
        ]);
    });
    it('uses calendar months and handles year rollover', () => {
        const periods = terminationPeriods(
            {
                ...account,
                createdAt: new Date('2025-12-30T17:00:00Z'),
                discount: 0n,
            } as any,
            new Date('2026-01-01T17:00:00Z'),
            'WIB',
        );
        expect(periods.map((p) => [p.from, p.through, p.amount])).toEqual([
            ['2025-12-31', '2025-12-31', 10000],
            ['2026-01-01', '2026-01-02', 20000],
        ]);
    });
    it('handles leap day and timezone boundaries', () => {
        const periods = terminationPeriods(
            {
                ...account,
                package: { price: 290000n },
                discount: 0n,
                createdAt: new Date('2024-02-28T17:00:00Z'),
            } as any,
            new Date('2024-02-29T16:59:59Z'),
            'WIB',
        );
        expect(periods[0]).toMatchObject({
            amount: 10000,
            from: '2024-02-29',
            through: '2024-02-29',
        });
    });
    it('does not create new service charges for prepaid customers', () => {
        expect(
            terminationPeriods(
                { ...account, subscriptionType: 'PREPAID' } as any,
                new Date(),
                'WIB',
            ),
        ).toEqual([]);
    });
});
describe('permanent termination workflow', () => {
    afterEach(() => vi.useRealTimers());
    function now() {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-13T02:00:00Z'));
    }
    it('only offers subscribed customers by name or customer number, including leading zeroes', async () => {
        const findMany = vi.fn().mockResolvedValue([]);
        const service = new TerminationService({ pppoeAccount: { findMany } } as any, {} as any, {} as any, {} as any, {} as any);
        await service.options('000007');
        expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {
            terminatedAt: null, terminations: { none: { status: { in: ['PENDING', 'COMPLETED'] } } }, OR: [{ customerName: { contains: '000007' } }, { customerNumber: 7n }],
        } }));
        await service.options('Paijo');
        expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {
            terminatedAt: null, terminations: { none: { status: { in: ['PENDING', 'COMPLETED'] } } }, OR: [{ customerName: { contains: 'Paijo' } }],
        } }));
    });
    it('requires admin for adding while all technicians may list and finish', () => {
        expect(Reflect.getMetadata('roles', TerminationController.prototype.notifyApproval)).toEqual(['admin']);
        expect(Reflect.getMetadata('roles', TerminationController.prototype.cancel)).toEqual(['admin']);
        expect(Reflect.getMetadata('roles', TerminationController)).toEqual([
            'admin',
            'teknisi',
        ]);
        expect(
            Reflect.getMetadata(
                'roles',
                TerminationController.prototype.create,
            ),
        ).toEqual(['admin']);
        expect(
            Reflect.getMetadata(
                'roles',
                TerminationController.prototype.options,
            ),
        ).toEqual(['admin']);
    });
    it('stops billing immediately at Add and freezes prorate despite months of collection delay and changed price', async () => {
        now();
        const { service, state, tx, radius, network, wa } = setup();
        const cutoff = new Date('2026-11-13T02:00:00Z');
        await service.create({ accountId: '7', reason: 'Pindah rumah' }, '9');
        expect(state().row.status).toBe('PENDING');
        expect(state().row.account).toMatchObject({ terminatedAt: cutoff, isActive: false });
        expect(state().row.account.odpPort).toBe(2);
        expect(state().invoices).toHaveLength(1);
        expect(state().invoices[0].amount).toBe(30000n);
        expect(state().deposits).toHaveLength(0);
        expect(radius.sync).toHaveBeenCalledOnce();
        expect(network.disconnect).toHaveBeenCalledOnce();
        expect(wa.notifyTermination).not.toHaveBeenCalled();
        expect(wa.notifyTerminationApproved).toHaveBeenCalledWith(expect.objectContaining({ customerNumber: 7n, prorateAmount: 30000, otherAmount: 0, totalAmount: 30000, terminationDate: '13 November 2026' }));
        vi.setSystemTime(new Date('2027-01-20T02:00:00Z'));
        state().row.account.package.price = 900000n;
        const bill = await service.summary('1');
        expect(bill.total).toBe(30000);
        await service.complete('1', { amount: bill.total }, '9');
        expect(state().row.account.terminatedAt).toEqual(cutoff);
        expect(state().row.completedAt).toEqual(new Date('2027-01-20T02:00:00Z'));
        expect(state().invoices).toHaveLength(1);
        expect(state().deposits).toEqual([expect.objectContaining({ amount: 30000n })]);
        expect(tx.pppoeAccount.update.mock.calls[0][0].data).not.toHaveProperty('odpPort');
        expect(state().row.account.odpPort).toBeNull();
    });
    it('rolls back the Add and final invoice if stopping RADIUS fails', async () => {
        now(); const { service, state, radius, network } = setup();
        radius.sync.mockRejectedValueOnce(new Error('SQL unavailable'));
        await expect(service.create({ accountId: '7', reason: 'Berhenti' }, '9')).rejects.toThrow('SQL unavailable');
        expect(state().row.account.terminatedAt).toBeNull();
        expect(state().invoices).toHaveLength(0);
        expect(network.disconnect).not.toHaveBeenCalled();
    });
    it('keeps the saved termination and offers retry when approval WA fails', async () => {
        now(); const { service, state, wa } = setup();
        wa.notifyTerminationApproved.mockResolvedValueOnce(false);
        const result = await service.create({ accountId: '7', reason: 'Pindah' }, '9');
        expect(result.whatsappNotified).toBe(false);
        expect(result.warnings.join()).toContain('WhatsApp persetujuan belum terkirim');
        expect(state().row.account.terminatedAt).toBeInstanceOf(Date);
        expect(state().invoices).toHaveLength(1);
        await service.notifyApproval('1');
        expect(wa.notifyTerminationApproved).toHaveBeenCalledTimes(2);
        expect(state().invoices).toHaveLength(1);
    });
    it('includes prorate and other outstanding charges separately in the approval', async () => {
        now(); const { service, invoices, wa } = setup();
        invoices.push({ id: 3n, invoiceNumber: 'OLD-INVOICE', status: 'PENDING', amount: 100000n, deposits: [{ amount: 20000n }] });
        await service.create({ accountId: '7', reason: 'Pindah' }, '9');
        expect(wa.notifyTerminationApproved).toHaveBeenCalledWith(expect.objectContaining({ prorateAmount: 30000, otherAmount: 80000, totalAmount: 110000 }));
    });
    it('lets admin cancel a pending request, restore normal billing and keep a permanent history for re-application', async () => {
        now(); const { service, state, tx } = setup();
        await service.create({ accountId: '7', reason: 'Salah input' }, '9');
        expect(state().invoices[0].amount).toBe(30000n);
        await service.cancel('1', { reason: 'Pelanggan melanjutkan langganan' }, '9');
        expect(state().row.status).toBe('CANCELLED');
        expect(state().row.account).toMatchObject({ terminatedAt: null, isActive: true, odpPort: 2, idCardNumber: account.idCardNumber });
        expect(state().invoices[0]).toMatchObject({ amount: 200000n, dueDate: new Date('2026-12-10T00:00:00Z') });
        expect(state().logs[0]).toMatchObject({ action: 'CANCEL', userName: 'Teknisi Budi', entityId: '1' });
        expect(state().settings['termination_cancel_1'].value).toContain('Pelanggan melanjutkan langganan');
        await service.create({ accountId: '7', reason: 'Penghentian baru' }, '9');
        expect(state().row.id).toBe(2n);
        expect(state().invoices[0].amount).toBe(30000n);
        expect(state().history[0]).toMatchObject({ id: 1n, status: 'CANCELLED' });
        expect(state().invoices).toHaveLength(1);
        expect(tx.pppoeAccount.update).toHaveBeenCalledTimes(3);
    });
    it('preserves recorded payments and creates only the difference instead of editing a paid final invoice', async () => {
        now(); const { service, state, invoices } = setup();
        await service.create({ accountId: '7', reason: 'Salah input' }, '9');
        invoices[0].status = 'PAID'; invoices[0].paidAt = new Date(); invoices[0].deposits = [{ amount: 30000n, status: 'ACCEPTED' }];
        await service.cancel('1', { reason: 'Lanjut' }, '9');
        expect(state().invoices[0]).toMatchObject({ amount: 30000n, status: 'PAID' });
        expect(state().invoices[1]).toMatchObject({ invoiceNumber: 'RESUME-1-1', amount: 170000n, status: 'PENDING' });
    });
    it('does not keep charging a resumed supplement when stopping again and does not duplicate it on a second cancellation', async () => {
        now(); const { service, state, invoices } = setup();
        await service.create({ accountId: '7', reason: 'Salah input' }, '9');
        invoices[0].status = 'PAID'; invoices[0].paidAt = new Date();
        await service.cancel('1', { reason: 'Lanjut' }, '9');
        expect(state().invoices[1].amount).toBe(170000n);
        await service.create({ accountId: '7', reason: 'Berhenti lagi' }, '9');
        expect((await service.summary('2')).total).toBe(0);
        expect(state().invoices[0].amount).toBe(30000n);
        expect(state().invoices[1].amount).toBe(0n);
        await service.cancel('2', { reason: 'Lanjut lagi' }, '9');
        expect(state().invoices.reduce((total, invoice) => total + Number(invoice.amount), 0)).toBe(200000);
    });
    it('keeps manual isolation and prior inactivity when cancellation restores the subscription', async () => {
        now(); const { service, state } = setup();
        state().row.account.manualIsolated = true; state().row.account.isActive = false;
        await service.create({ accountId: '7', reason: 'Salah input' }, '9');
        await service.cancel('1', { reason: 'Lanjut' }, '9');
        expect(state().row.account).toMatchObject({ manualIsolated: true, isActive: false, terminatedAt: null });
    });
    it('restores a valid payment promise without extending its deadline', async () => {
        now(); const { service, tx, state } = setup();
        tx.paymentPromise.findMany.mockResolvedValue([{ id: 4n, status: 'ACTIVE', deadline: new Date('2026-11-20T17:00:00Z'), disconnectPending: false }]);
        await service.create({ accountId: '7', reason: 'Salah input' }, '9');
        await service.cancel('1', { reason: 'Lanjut' }, '9');
        expect(tx.paymentPromise.updateMany).toHaveBeenLastCalledWith({ where: { id: 4n, pppoeAccountId: 7n, status: 'CANCELLED' }, data: { status: 'ACTIVE', disconnectPending: false } });
        expect(state().row.account.isActive).toBe(true);
    });
    it('keeps access isolated if an original payment promise expired while termination was pending', async () => {
        now(); const { service, tx, state } = setup();
        tx.paymentPromise.findMany.mockResolvedValue([{ id: 4n, status: 'ACTIVE', deadline: new Date('2026-11-14T17:00:00Z'), disconnectPending: false }]);
        await service.create({ accountId: '7', reason: 'Salah input' }, '9');
        vi.setSystemTime(new Date('2026-11-16T02:00:00Z'));
        await service.cancel('1', { reason: 'Lanjut' }, '9');
        expect(state().row.account).toMatchObject({ terminatedAt: null, isActive: false });
        expect(tx.paymentPromise.updateMany).toHaveBeenLastCalledWith({ where: { id: 4n, pppoeAccountId: 7n, status: 'CANCELLED' }, data: { status: 'EXPIRED', disconnectPending: true } });
    });
    it('rolls back cancellation and invoice corrections if RADIUS SQL restoration fails', async () => {
        now(); const { service, state, radius, network } = setup();
        await service.create({ accountId: '7', reason: 'Salah input' }, '9');
        radius.sync.mockRejectedValueOnce(new Error('SQL unavailable'));
        await expect(service.cancel('1', { reason: 'Lanjut' }, '9')).rejects.toThrow('SQL unavailable');
        expect(state().row.status).toBe('PENDING'); expect(state().row.account.terminatedAt).not.toBeNull();
        expect(state().invoices[0].amount).toBe(30000n); expect(state().logs).toHaveLength(0); expect(network.disconnect).toHaveBeenCalledTimes(1);
    });
    it('refuses cancellation after collection or after another admin has already cancelled', async () => {
        now(); const { service, state, tx } = setup();
        for (const status of ['COMPLETED', 'CANCELLED']) {
            state().row.status = status;
            await expect(service.cancel('1', { reason: 'Lanjut' }, '9')).rejects.toThrow('belum diambil');
        }
        expect(tx.pppoeAccount.update).not.toHaveBeenCalled();
    });
    it('retains paid periods and subtracts cash already reserved in pending deposits', async () => {
        now();
        const { service, invoices } = setup();
        invoices.push(
            {
                id: 2n,
                invoiceNumber: 'INV/202611/0000007',
                status: 'PAID',
                amount: 30000n,
                deposits: [],
            },
            {
                id: 3n,
                invoiceNumber: 'ADD-1',
                status: 'PENDING',
                amount: 100000n,
                deposits: [{ amount: 40000n }],
            },
        );
        const bill = await service.summary('1');
        expect(bill.total).toBe(60000);
        expect(bill.invoices).toHaveLength(1);
    });
    it('records actor, final prorate and cash deposit atomically without deleting identity or history', async () => {
        now();
        const { service, state, radius, network, wa } = setup();
        const bill = await service.summary('1');
        expect(bill.total).toBe(30000);
        await service.complete('1', { amount: bill.total }, '9');
        expect(state().row).toMatchObject({
            status: 'COMPLETED',
            collectedByUserId: 9n,
            collectedByName: 'Teknisi Budi',
            collectedAmount: 30000n,
        });
        expect(state().row.account).toMatchObject({
            isActive: false,
            idCardNumber: account.idCardNumber,
            idCardPhoto: account.idCardPhoto,
            odpPort: null,
        });
        expect(state().deposits).toEqual([
            expect.objectContaining({
                collectorUserId: 9n,
                amount: 30000n,
                pppoeAccountId: 7n,
            }),
        ]);
        expect(state().invoices).toHaveLength(1);
        expect(radius.sync).toHaveBeenCalledOnce();
        expect(network.disconnect).toHaveBeenCalledOnce();
        expect(wa.notifyTermination).toHaveBeenCalledOnce();
        await expect(
            service.complete('1', { amount: bill.total }, '9'),
        ).rejects.toThrow('sudah selesai');
        expect(state().deposits).toHaveLength(1);
    });
    it('refuses a stale quoted amount before mutating any payment', async () => {
        now();
        const { service, state, network } = setup();
        await expect(service.complete('1', { amount: 1 }, '9')).rejects.toThrow(
            'Tagihan berubah',
        );
        expect(state().row.status).toBe('PENDING');
        expect(state().invoices).toHaveLength(0);
        expect(network.disconnect).not.toHaveBeenCalled();
    });
    it('rolls back status and money if RADIUS SQL sync fails', async () => {
        now();
        const { service, state, radius, network } = setup();
        radius.sync.mockRejectedValueOnce(new Error('SQL error'));
        await expect(
            service.complete('1', { amount: 30000 }, '9'),
        ).rejects.toThrow('SQL error');
        expect(state().row.status).toBe('PENDING');
        expect(state().deposits).toHaveLength(0);
        expect(network.disconnect).not.toHaveBeenCalled();
    });
    it('preserves completion if WA fails and supports notification retry', async () => {
        now();
        const { service, state, wa } = setup();
        wa.notifyTermination.mockResolvedValueOnce(false);
        const result = await service.complete('1', { amount: 30000 }, '9');
        expect(state().row.status).toBe('COMPLETED');
        expect(result.warnings.join()).toContain('WhatsApp belum terkirim');
        await service.resend('1');
        expect(state().row.waSentAt).toBeInstanceOf(Date);
        expect(state().deposits).toHaveLength(1);
    });
    it('still completes zero balance customers without a zero cash deposit', async () => {
        now();
        const { service, state, invoices } = setup();
        invoices.push({
            id: 1n,
            invoiceNumber: 'INV/202611/0000007',
            status: 'PAID',
            amount: 30000n,
            deposits: [],
        });
        await service.complete('1', { amount: 0 }, '9');
        expect(state().row.status).toBe('COMPLETED');
        expect(state().deposits).toHaveLength(0);
    });
});
