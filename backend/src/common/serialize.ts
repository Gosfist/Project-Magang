export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)),
  ) as T;
}

export function pageMeta(page: number, perPage: number, total: number) {
  return {
    currentPage: page,
    lastPage: Math.max(1, Math.ceil(total / perPage)),
    perPage,
    total,
  };
}
