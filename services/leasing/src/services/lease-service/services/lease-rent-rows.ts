import { LeaseStatus, leasing } from '@onecore/types'
import { z } from 'zod'

import type { CachedLease } from '../../../common/lease-cache'
import type {
  TenfastArticle,
  TenfastInvoiceRow,
  TenfastLease,
  YearMonthDayString,
} from '../adapters/tenfast/schemas'

type ListItem = leasing.v1.LeaseRentRowListItem
type GetLeasesStatus = z.infer<typeof leasing.v1.GetLeasesStatusSchema>

// Same meaning as the status filter on /leases/by-contact-code.
// 'current' is Tenfast stage 'active' (see calculateLeaseStatus).
const STATUS_TO_LEASE_STATUS: Record<GetLeasesStatus, LeaseStatus> = {
  current: LeaseStatus.Current,
  upcoming: LeaseStatus.Upcoming,
  'about-to-end': LeaseStatus.AboutToEnd,
  ended: LeaseStatus.Ended,
  'pending-signature': LeaseStatus.PendingSignature,
  'preliminary-terminated': LeaseStatus.PreliminaryTerminated,
  'not-sent': LeaseStatus.NotSent,
}

/**
 * Flattens cached leases into one list item per rent row, with the article
 * code and timestamps looked up from the article catalog. Rows keep the
 * order they have on the lease; leases are sorted by lease id so rows of the
 * same lease stay together.
 */
export const toRentRowListItems = (
  leases: CachedLease[],
  articles: TenfastArticle[],
  homeInsuranceArticleId: string
): ListItem[] => {
  const articleById = new Map(articles.map((a) => [a._id, a]))

  return [...leases]
    .sort((a, b) => a.leaseId.localeCompare(b.leaseId, 'sv'))
    .flatMap((lease) =>
      lease.rentRows.map((row): ListItem => {
        const articleId = row.articleId || null
        const article = articleId ? articleById.get(articleId) : undefined
        return {
          leaseId: lease.leaseId,
          leaseStatus: lease.status,
          contactCodes: lease.contacts.map((c) => c.contactCode),
          rowId: row.id,
          articleId,
          articleCode: article?.code ?? null,
          label: row.label,
          amount: row.amount,
          from: row.from ?? null,
          to: row.to ?? null,
          isHomeInsurance:
            articleId !== null && articleId === homeInsuranceArticleId,
          articleCreatedAt: article?.createdAt ?? null,
          articleUpdatedAt: article?.updatedAt ?? null,
        }
      })
    )
}

const matchesQuery = (item: ListItem, q: string): boolean => {
  const needle = q.toLowerCase()
  return [
    item.leaseId,
    item.rowId,
    item.label,
    item.articleCode ?? '',
    ...item.contactCodes,
  ].some((value) => value.toLowerCase().includes(needle))
}

export const filterRentRowListItems = (
  items: ListItem[],
  params: Pick<leasing.v1.LeaseRentRowsQueryParams, 'q' | 'status' | 'filter'>
): ListItem[] => {
  const statuses = params.status?.length
    ? new Set(params.status.map((s) => STATUS_TO_LEASE_STATUS[s]))
    : null

  return items.filter((item) => {
    if (statuses && !statuses.has(item.leaseStatus)) return false
    if (params.filter === 'homeInsurance' && !item.isHomeInsurance) return false
    if (
      params.filter === 'sameDate' &&
      !(item.from !== null && item.from === item.to)
    )
      return false
    if (params.q && !matchesQuery(item, params.q)) return false
    return true
  })
}

/** What to send to Tenfast to give a home insurance row a new end date. */
export type HomeInsuranceEndDatePlan = {
  rowsToDelete: string[]
  rowsToAdd: Omit<TenfastInvoiceRow, '_id'>[]
}

/**
 * Plans a change of T.o.m. (to) on one home insurance row. Only rows with the
 * home insurance article may be changed. Tenfast can't edit a row in place,
 * so the plan deletes the row and adds an identical one with the new end
 * date (the same way POST /leases/:leaseId/home-insurance/cancel does it).
 */
export const planHomeInsuranceEndDate = (
  lease: TenfastLease,
  request: leasing.v1.SetHomeInsuranceEndDateRequest,
  homeInsuranceArticleId: string
):
  | { ok: true; plan: HomeInsuranceEndDatePlan }
  | { ok: false; err: leasing.v1.SetHomeInsuranceEndDateError } => {
  const row = lease.hyror.find((r) => r._id === request.rowId)
  if (!row) return { ok: false, err: 'row-not-found' }
  if (!row.article || row.article !== homeInsuranceArticleId)
    return { ok: false, err: 'not-home-insurance' }
  // yyyy-mm-dd strings compare correctly as text
  if (row.from && request.endDate < row.from)
    return { ok: false, err: 'end-before-start' }
  if (row.to === request.endDate) return { ok: false, err: 'unchanged' }

  return {
    ok: true,
    plan: {
      rowsToDelete: [row._id],
      rowsToAdd: [
        {
          amount: row.amount,
          vat: row.vat,
          article: row.article,
          label: row.label,
          from: row.from ?? undefined,
          // Already checked to be yyyy-mm-dd by SetHomeInsuranceEndDateRequestSchema.
          // Not run through toYearMonthDayString(new Date(...)), which would
          // shift the day in time zones west of UTC.
          to: request.endDate as YearMonthDayString,
        },
      ],
    },
  }
}
