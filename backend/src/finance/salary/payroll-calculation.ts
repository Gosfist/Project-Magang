export const WIB = 7 * 60 * 60 * 1000;
export const dateKey = (date: Date) => new Date(date.getTime() + WIB).toISOString().slice(0, 10);
export const clockOn = (day: string, time: string) => new Date(`${day}T${time}:00+07:00`);
export const dateOnly = (day: string) => new Date(`${day}T00:00:00Z`);
export type AttendanceRule = { checkInStart: string; lateAfter: string; checkOutTime: string; autoCheckoutTime: string };
export const defaultAttendanceRule: AttendanceRule = { checkInStart: '08:00', lateAfter: '08:15', checkOutTime: '17:00', autoCheckoutTime: '17:15' };
export type WageProfile = { salaryType: string; amount: bigint; maxLeave: number; excessLeaveCut: boolean; excessLeaveAmount: bigint; lateCut: boolean; lateAmount: bigint; earlyCut: boolean; earlyAmount: bigint };
export type WageAttendance = { workDate: Date; checkIn: Date; checkOut: Date | null; scheduledStart: Date; scheduledEnd: Date; autoCheckoutAt: Date; isLate: boolean };
export function attendanceWage(profile: WageProfile, records: WageAttendance[], leaveDays: number, eligibleDays: number, monthDays: number, now: Date) {
  const daily = profile.salaryType === 'DAILY';
  const base = daily ? profile.amount * BigInt(records.length) : profile.amount * BigInt(eligibleDays) / BigInt(monthDays);
  const lateDays = records.filter(row => row.isLate).length;
  let earlyDays = 0, earlyCut = 0n;
  for (const row of records) {
    const out = row.checkOut ?? (now >= row.autoCheckoutAt ? row.autoCheckoutAt : null);
    if (!out || out >= row.scheduledEnd) continue;
    earlyDays++;
    if (daily) {
      const duration = Math.max(1, row.scheduledEnd.getTime() - row.scheduledStart.getTime());
      const missing = Math.min(duration, row.scheduledEnd.getTime() - out.getTime());
      earlyCut += profile.amount * BigInt(missing) / BigInt(duration);
    } else if (profile.earlyCut) earlyCut += profile.earlyAmount;
  }
  const excessDays = Math.max(0, leaveDays - profile.maxLeave);
  const leaveCut = !daily && profile.excessLeaveCut ? profile.excessLeaveAmount * BigInt(excessDays) : 0n;
  const lateCut = profile.lateCut ? profile.lateAmount * BigInt(lateDays) : 0n;
  const deduction = leaveCut + lateCut + earlyCut;
  return { base, lateDays, earlyDays, excessDays, leaveDays, leaveCut, lateCut, earlyCut, deduction: deduction > base ? base : deduction, netWage: base > deduction ? base - deduction : 0n, presentDays: records.length };
}
export function divideBonus(total: bigint, ids: bigint[]) {
  const sorted = [...new Set(ids)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  if (!sorted.length) return [];
  const base = total / BigInt(sorted.length), remainder = total % BigInt(sorted.length);
  return sorted.map((userId, index) => ({ userId, bonusAmount: base + (BigInt(index) < remainder ? 1n : 0n) }));
}
