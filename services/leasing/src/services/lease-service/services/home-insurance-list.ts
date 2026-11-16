import { leasing } from '@onecore/types'

import { TenfastLease } from '../adapters/tenfast/schemas'
import { toSwedishDay } from '../adapters/tenfast/tenfast-rental-object-helpers'
import { mapLeasesToLfListItems } from './lf-export'
import { findInsuredTenant, toHomeInsuranceListItem } from './home-insurance'

type Item = leasing.HomeInsuranceListItem

/**
 * Every home insurance row on the leases, one item per row, for quality
 * checks. Unlike the Länsförsäkringar file it keeps company tenants, negative
 * amounts, rows without a first day and every row of a lease with several.
 */
export const mapHomeInsuranceRows = (
  leases: TenfastLease[],
  articleId: string
): Item[] =>
  leases.flatMap((lease) => {
    const tenant = findInsuredTenant(lease) ?? lease.hyresgaster[0]
    return lease.hyror
      .filter((row) => row.article === articleId)
      .map((row) => toHomeInsuranceListItem(lease, row, tenant))
  })

const normalizeCode = (code: string) => code.trim().toUpperCase()

export const filterHomeInsuranceItems = (
  items: Item[],
  params: Pick<
    leasing.HomeInsuranceListQueryParams,
    'q' | 'contactCodes' | 'status' | 'sameDate'
  >
): Item[] => {
  const q = params.q?.trim().toLowerCase()
  const contactCodes = params.contactCodes
    ? new Set(params.contactCodes.map(normalizeCode))
    : null
  const statuses =
    params.status && params.status.length > 0 ? new Set(params.status) : null

  return items.filter((item) => {
    if (
      contactCodes &&
      (!item.contactCode || !contactCodes.has(normalizeCode(item.contactCode)))
    )
      return false

    if (statuses && !statuses.has(item.leaseStatus)) return false

    if (
      params.sameDate &&
      !(item.rowFromDate && item.rowFromDate === item.rowToDate)
    )
      return false

    if (q) {
      const fields = [
        item.leaseId,
        item.rentalObjectCode,
        item.contactCode,
        item.address,
      ]
      if (!fields.some((field) => field?.toLowerCase().includes(q)))
        return false
    }

    return true
  })
}

const collator = new Intl.Collator('sv')

const sortValue = (
  item: Item,
  sortBy: leasing.HomeInsuranceListSortBy
): string | number | null => item[sortBy]

/**
 * Sorts in Swedish order (å, ä and ö after z). Empty values go last in both
 * directions. Ties are broken by leaseId and rowId, so pages never overlap.
 */
export const sortHomeInsuranceItems = (
  items: Item[],
  sortBy: leasing.HomeInsuranceListSortBy,
  sortOrder: 'asc' | 'desc'
): Item[] => {
  const multiplier = sortOrder === 'asc' ? 1 : -1

  return [...items].sort((a, b) => {
    const aValue = sortValue(a, sortBy)
    const bValue = sortValue(b, sortBy)

    if (aValue === null && bValue !== null) return 1
    if (bValue === null && aValue !== null) return -1

    let order = 0
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      order = aValue - bValue
    } else if (aValue !== null && bValue !== null) {
      order = collator.compare(String(aValue), String(bValue))
    }
    if (order !== 0) return order * multiplier

    return (
      collator.compare(a.leaseId, b.leaseId) ||
      collator.compare(a.rowId, b.rowId)
    )
  })
}

// The items of the last cache contents, per rows mode and day, so paging
// through the list does not map every lease again.
const itemsMemo = new Map<
  leasing.HomeInsuranceListRows,
  { leases: TenfastLease[]; articleId: string; today: string; items: Item[] }
>()

const getItems = (
  leases: TenfastLease[],
  articleId: string,
  rows: leasing.HomeInsuranceListRows,
  today: string
): Item[] => {
  const memo = itemsMemo.get(rows)
  if (
    memo &&
    memo.leases === leases &&
    memo.articleId === articleId &&
    memo.today === today
  )
    return memo.items

  const items =
    rows === 'lf'
      ? mapLeasesToLfListItems(leases, articleId, today)
      : mapHomeInsuranceRows(leases, articleId)
  itemsMemo.set(rows, { leases, articleId, today, items })
  return items
}

/**
 * Every item of the home insurance list that matches the query, sorted, for
 * an export that needs them all from one read of the cache.
 */
export const listAllHomeInsuranceItems = (
  leases: TenfastLease[],
  articleId: string,
  params: leasing.HomeInsuranceListAllQueryParams,
  today: string = toSwedishDay(new Date())
): Item[] =>
  sortHomeInsuranceItems(
    filterHomeInsuranceItems(
      getItems(leases, articleId, params.rows, today),
      params
    ),
    params.sortBy,
    params.sortOrder
  )

/**
 * One page of the home insurance list, filtered and sorted, and how many
 * items match in all.
 */
export const listHomeInsuranceItems = (
  leases: TenfastLease[],
  articleId: string,
  params: leasing.HomeInsuranceListQueryParams,
  today: string = toSwedishDay(new Date())
): { content: Item[]; totalRecords: number } => {
  const sorted = listAllHomeInsuranceItems(leases, articleId, params, today)
  const start = (params.page - 1) * params.limit

  return {
    content: sorted.slice(start, start + params.limit),
    totalRecords: sorted.length,
  }
}

/**
 * The query of a list request without page and limit, for the pagination
 * links, so every link keeps the filters and sort order.
 */
export const homeInsuranceListLinkParams = (
  params: leasing.HomeInsuranceListQueryParams
): Record<string, string> => {
  const linkParams: Record<string, string> = {
    rows: params.rows,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  }
  if (params.q) linkParams.q = params.q
  // Kept even when empty, since an empty list of contact codes matches
  // nothing rather than everything.
  if (params.contactCodes)
    linkParams.contactCodes = params.contactCodes.join(',')
  if (params.status && params.status.length > 0)
    linkParams.status = params.status.join(',')
  if (params.sameDate) linkParams.sameDate = 'true'
  return linkParams
}
