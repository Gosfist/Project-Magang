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
    idCardNumber: '1234567890123456',
    idCardPhoto: '/uploads/ktp/kept.jpg',
    subscriptionType: 'POSTPAID',
    discount: 10000n,
    package: { price: 310000n },
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
    const tx = {
        subscriptionTermination: {
            findUnique: vi.fn(async () => row),
            create: vi.fn(async ({ data }) => { Object.assign(row, data); return row; }),
            updateMany: vi.fn(async ({ where, data }) => {
                if (row.status !== where.status) return { count: 0 };
                Object.assign(row, data);
                return { count: 1 };
            }),
            update: vi.fn(async ({ data }) => Object.assign(row, data)),
        },
        invoice: {
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
        paymentPromise: { updateMany: vi.fn(async () => ({ count: 0 })) },
        pppoeAccount: {
            findUnique: vi.fn(async () => row.account),
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
            const before = structuredClone({ row, invoices, deposits });
            try {
                return await work(tx);
            } catch (error) {
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
            expect(['PENDING', 'COMPLETED']).toContain(row.status);
            expect(row.account.terminatedAt).toBeInstanceOf(Date);
            return { warnings: [] };
        }),
    };
    const wa = { notifyTermination: vi.fn(async () => true) };
    const service = new TerminationService(
        prisma as any,
        radius as any,
        network as any,
        { billing: async () => ({ billingTimezone: 'WIB' }) } as any,
        wa as any,
    );
    return {
        service,
        tx,
        prisma,
        radius,
        network,
        wa,
        state: () => ({ row, invoices, deposits }),
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
    it('requires admin for adding while all technicians may list and finish', () => {
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
