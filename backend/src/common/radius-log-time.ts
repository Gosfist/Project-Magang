// FreeRADIUS post-auth writes server-local wall time into authdate without a timezone.
// Prisma reads these fields as UTC; interpret the wall clock before returning an ISO instant.
export function radiusLogTime(value: Date, timezone = process.env.RADIUS_LOG_TIMEZONE || 'WIB'): Date {
  const offsets: Record<string, number> = { UTC: 0, WIB: 7, WITA: 8, WIT: 9 };
  if (!(timezone in offsets)) throw new Error('RADIUS_LOG_TIMEZONE harus UTC, WIB, WITA, atau WIT.');
  return new Date(value.getTime() - offsets[timezone] * 60 * 60 * 1000);
}
