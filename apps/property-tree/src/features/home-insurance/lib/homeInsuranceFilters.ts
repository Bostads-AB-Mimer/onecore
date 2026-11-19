import type { HomeInsuranceListQueryParams } from '@/services/api/core/homeInsuranceService'

type LfStatus = NonNullable<HomeInsuranceListQueryParams['status']>[number]
type SortBy = NonNullable<HomeInsuranceListQueryParams['sortBy']>

/** lf: the rows of the Länsförsäkringar file. all: every row, for the quality
 * check. same-date: every row whose first and last day are the same. */
export type HomeInsuranceView = 'lf' | 'all' | 'same-date'

const LF_STATUS_LABELS: Record<LfStatus, string> = {
  G: 'Gällande',
  K: 'Kommande',
  '*': 'Uppsagd',
}
const LF_STATUSES: LfStatus[] = ['G', 'K', '*']

export const formatLfStatus = (status: LfStatus) =>
  `${status} – ${LF_STATUS_LABELS[status]}`

export const LF_STATUS_OPTIONS = LF_STATUSES.map((status) => ({
  value: status,
  label: formatLfStatus(status),
}))

const isLfStatus = (value: string): value is LfStatus =>
  LF_STATUSES.some((status) => status === value)

const SORT_KEYS: readonly string[] = [
  'leaseId',
  'leaseStatus',
  'leaseFromDate',
  'leaseToDate',
  'rentalObjectCode',
  'address',
  'rowFromDate',
  'rowToDate',
  'monthlyAmount',
  'contactCode',
] satisfies SortBy[]
const isSortBy = (value: string | null): value is SortBy =>
  value !== null && SORT_KEYS.includes(value)

// Same minimum as FilterBar's "Skriv minst 3 tecken" hint.
const MIN_SEARCH_LENGTH = 3

export function parseHomeInsuranceView(
  value: string | null
): HomeInsuranceView {
  return value === 'all' || value === 'same-date' ? value : 'lf'
}

/** Maps the page's URL parameters to the list's query. Unknown values in the
 * URL (an old bookmark, a typo) are dropped instead of sent to the API. */
export function toHomeInsuranceQuery(
  urlParams: URLSearchParams,
  search: string
): HomeInsuranceListQueryParams {
  const view = parseHomeInsuranceView(urlParams.get('view'))
  const status = urlParams.getAll('status').filter(isLfStatus)
  const sortBy = urlParams.get('sortBy')
  const sortOrder = urlParams.get('sortOrder')
  const q = search.trim()

  return {
    q: q.length >= MIN_SEARCH_LENGTH ? q : undefined,
    status: status.length > 0 ? status : undefined,
    rows: view === 'lf' ? 'lf' : 'all',
    sameDate: view === 'same-date' ? true : undefined,
    sortBy: isSortBy(sortBy) ? sortBy : undefined,
    sortOrder:
      sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
  }
}
