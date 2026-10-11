export const extraRoles = ['sales', 'kolektor', 'finance', 'teknisi'] as const;
export function accessRoles(user: { role: string; additionalRoles?: unknown; primaryRole?: string }): string[] {
  const primary = user.primaryRole ?? user.role;
  if (primary === 'admin') return ['admin', ...extraRoles];
  return [...new Set([primary, ...(Array.isArray(user.additionalRoles)
    ? user.additionalRoles.filter((role): role is string => typeof role === 'string' && (extraRoles as readonly string[]).includes(role)) : [])])];
}
