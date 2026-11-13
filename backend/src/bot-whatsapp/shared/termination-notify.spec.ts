import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsappNotifyService } from './whatsapp-notify.service.js';
function setup(saved?: string) {
    const prisma = {
        appSetting: {
            findUnique: vi.fn(async ({ where }) =>
                where.key === 'wa_template_termination_approved' && saved
                    ? { value: saved }
                    : null,
            ),
        },
    };
    const fetch = vi.fn(async (_url: string, _options: any) => ({ ok: true }));
    vi.stubGlobal('fetch', fetch);
    const service = new WhatsappNotifyService(
        prisma as any,
        { get: (_key: string, fallback: string) => fallback } as any,
    );
    return { service, prisma, fetch };
}
const approval = {
    customerName: 'Paijo',
    customerNumber: 7n,
    phone: '08123',
    packageName: '50 Mb',
    terminationDate: '13 November 2026',
    prorateAmount: 30000,
    otherAmount: 80000,
    totalAmount: 110000,
};
describe('termination WhatsApp templates', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('uses a saved approval template and replaces every value with the payable amounts', async () => {
        const { service, fetch } = setup(
            '{nama} {nomor_pelanggan} {paket} {tanggal_berhenti} {prorata} {tunggakan} {total_tagihan}',
        );
        expect(await service.notifyTerminationApproved(approval)).toBe(true);
        const sent = JSON.parse(fetch.mock.calls[0][1].body);
        expect(sent.phone).toBe('08123');
        expect(sent.message).toContain('Paijo 000007 50 Mb 13 November 2026');
        expect(sent.message).toMatch(/30[.]000.*80[.]000.*110[.]000/);
        expect(sent.message).not.toMatch(/\{[a-z_]+\}/);
    });
    it('has a default approval message that promises collection and stops billing at the admin date', async () => {
        const { service, fetch } = setup();
        await service.notifyTerminationApproved(approval);
        const sent = JSON.parse(fetch.mock.calls[0][1].body);
        expect(sent.message).toContain('telah disetujui');
        expect(sent.message).toContain('mengambil perangkat');
        expect(sent.message).toContain('prorata');
    });
    it('reports bot failure without claiming delivery', async () => {
        const { service, fetch } = setup();
        fetch.mockRejectedValueOnce(new Error('offline'));
        expect(await service.notifyTerminationApproved(approval)).toBe(false);
    });
    it('uses the configurable collection template after completion', async () => {
        const { service, prisma, fetch } = setup();
        prisma.appSetting.findUnique.mockImplementation(async ({ where }) =>
            where.key === 'wa_template_termination_completed'
                ? { value: '{nama} {nama_petugas} {jumlah}' }
                : null,
        );
        await service.notifyTermination({
            ...approval,
            collectedByName: 'Budi',
            amount: 30000,
        });
        expect(JSON.parse(fetch.mock.calls[0][1].body).message).toMatch(
            /Paijo Budi.*30[.]000/,
        );
    });
});
