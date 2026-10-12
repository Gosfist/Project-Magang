// Shared by account and PSB queries. Keep this filter inside AND when a query
// already has an OR for role ownership or area access.
export function customerSearch(search: string) {
  const query = search.trim();
  if (!query) return {};
  return {
    OR: [
      { customerName: { contains: query } },
      ...(/^\d{1,18}$/.test(query) ? [{ customerNumber: BigInt(query) }] : []),
    ],
  };
}
