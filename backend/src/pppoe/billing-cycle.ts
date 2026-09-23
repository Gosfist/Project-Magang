export const billingOffsets = { WIB: 7, WITA: 8, WIT: 9 };

export function localBillingDate(date: Date, timezone: keyof typeof billingOffsets) {
  return new Date(date.getTime() + billingOffsets[timezone] * 3600000);
}

export function firstBillingCycle(activatedAt: Date, price: number, endDay: number, timezone: keyof typeof billingOffsets) {
  const local = localBillingDate(activatedAt, timezone);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const nextDays = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return {
    amount: Math.round(price * (days - local.getUTCDate() + 1) / days),
    dueDate: new Date(Date.UTC(year, month + 1, Math.min(endDay, nextDays))),
  };
}
