// Rows per page the user can pick. The lease search caps `limit` at 500
// (LeaseSearchQueryParamsSchema in libs/types), so no option may exceed it.
export const PAGE_SIZE_OPTIONS = [50, 100, 250, 500] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 100

/** The page size in the URL, or the default when it is missing or not an option. */
export function parsePageSize(raw: string | null): PageSize {
  const value = Number(raw)
  return (
    PAGE_SIZE_OPTIONS.find((option) => option === value) ?? DEFAULT_PAGE_SIZE
  )
}
