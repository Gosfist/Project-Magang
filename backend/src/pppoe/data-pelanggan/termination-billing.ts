import {
    billingOffsets,
    localBillingDate,
    serviceInvoiceNumber,
} from './billing-cycle.js';
// Postpaid service is billed in arrears. Retain existing invoices and fill uncovered service periods.
export function terminationPeriods(
    account: {
        customerNumber: bigint;
        createdAt: Date | null;
        subscriptionType: string;
        discount: bigint;
        package: { price: bigint };
    },
    now: Date,
    timezone: keyof typeof billingOffsets,
) {
    if (account.subscriptionType !== 'POSTPAID' || !account.createdAt)
        return [];
    const start = localBillingDate(account.createdAt, timezone),
        end = localBillingDate(now, timezone);
    const price = Math.max(
        0,
        Number(account.package.price) - Number(account.discount),
    );
    const rows: {
        invoiceNumber: string;
        amount: number;
        from: string;
        through: string;
    }[] = [];
    for (
        let year = start.getUTCFullYear(), month = start.getUTCMonth();
        year < end.getUTCFullYear() ||
        (year === end.getUTCFullYear() && month <= end.getUTCMonth());
        month++
    ) {
        if (month === 12) {
            month = 0;
            year++;
        }
        if (
            year > end.getUTCFullYear() ||
            (year === end.getUTCFullYear() && month > end.getUTCMonth())
        )
            break;
        const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const first =
            year === start.getUTCFullYear() && month === start.getUTCMonth()
                ? start.getUTCDate()
                : 1;
        const last =
            year === end.getUTCFullYear() && month === end.getUTCMonth()
                ? end.getUTCDate()
                : days;
        rows.push({
            invoiceNumber: serviceInvoiceNumber(
                year,
                month + 1,
                account.customerNumber,
            ),
            amount: Math.round((price * Math.max(0, last - first + 1)) / days),
            from: new Date(Date.UTC(year, month, first))
                .toISOString()
                .slice(0, 10),
            through: new Date(Date.UTC(year, month, last))
                .toISOString()
                .slice(0, 10),
        });
    }
    return rows;
}
