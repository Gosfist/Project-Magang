export const additionalRoleOptions = ['sales', 'kolektor', 'finance', 'teknisi'];
export const DASHBOARD_URL = '/dashboard';
export function userRoles(user: { role: string; additionalRoles?: string[] | null }): string[] {
  return user.role === 'admin' ? ['admin', ...additionalRoleOptions]
    : [...new Set([user.role, ...(user.additionalRoles ?? []).filter(role => additionalRoleOptions.includes(role))])];
}
export function roleForUrl(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  if (/\/finance\//.test(path)) return 'finance';
  if (/\/kolektor\//.test(path)) return 'kolektor';
  if (/\/registrasi-pelanggan$/.test(path)) return 'sales';
  if (/\/teknisi\//.test(path) || path.endsWith('/pasang-baru')) return 'teknisi';
  return null;
}
