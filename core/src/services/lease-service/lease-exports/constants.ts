export const LEASE_EXPORT_STORAGE_PREFIX = 'lease-exports/'

export const leaseExportStorageKey = (
  userId: string,
  exportId: string,
  date: Date
): string =>
  `${LEASE_EXPORT_STORAGE_PREFIX}${userId}/${exportId}/hyreskontrakt-${date.toISOString().slice(0, 10)}.xlsx`
