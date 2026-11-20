import { leasing } from '@onecore/types'
import {
  TenfastInvoiceRow,
  TenfastLease,
  TenfastTenant,
  YearMonthDayString,
} from '../adapters/tenfast/schemas'
import {
  isRentRowInForceOn,
  toSwedishDay,
} from '../adapters/tenfast/tenfast-rental-object-helpers'
import { calculateLeaseStatus } from '../helpers/tenfast'

// A row whose last day is before its first day is never in force. Cancelling
// before the start used to leave such rows behind; they count as ended.
const isVoid = (row: TenfastInvoiceRow) =>
  !!row.from && !!row.to && row.to < row.from

// A row of the article that bills the insurance. Xpand used an extra row of
// the same article with a negative amount to pay money back, and imported
// leases still hold such rows: they are never the insurance, and ending or
// cancelling the insurance leaves them alone.
const isInsuranceRow = (row: TenfastInvoiceRow, articleId: string) =>
  row.article === articleId && row.amount >= 0

// The row with the greatest (or, with pickLowest, the lowest) key. The first
// one wins a tie.
const pickBy = (
  rows: TenfastInvoiceRow[],
  key: (row: TenfastInvoiceRow) => string,
  pickLowest = false
): TenfastInvoiceRow | undefined =>
  rows.reduce<TenfastInvoiceRow | undefined>((picked, row) => {
    if (!picked) return row
    const better = pickLowest ? key(row) < key(picked) : key(row) > key(picked)
    return better ? row : picked
  }, undefined)

// The earliest open-ended row that starts after the given row ends, such as
// the row that takes over after a price change. Undefined when the row has
// no last day or no such row follows it.
const openSuccessor = (
  row: TenfastInvoiceRow,
  valid: TenfastInvoiceRow[]
): TenfastInvoiceRow | undefined => {
  const end = row.to
  if (!end) return undefined
  return pickBy(
    valid.filter(
      (candidate) =>
        candidate.to == null && !!candidate.from && candidate.from > end
    ),
    (candidate) => candidate.from ?? '',
    true
  )
}

/**
 * The home insurance row of a lease that matters now: the row in force today
 * (the latest started if several are), else the next one to start, else the
 * one that ended last. A lease can hold several rows of the article, such as
 * an ended row and a new one, so the first row is not necessarily the one in
 * force. When the row found has a last day but an open-ended row takes over
 * after it, that row is the one that matters: the insurance goes on. Rows
 * with a negative amount pay money back and are never picked. Days are
 * Swedish days, as Tenfast's are.
 */
export const selectCurrentHomeInsuranceRow = (
  hyror: TenfastInvoiceRow[],
  articleId: string,
  today: string = toSwedishDay(new Date())
): TenfastInvoiceRow | undefined => {
  const rows = hyror.filter((row) => isInsuranceRow(row, articleId))
  const valid = rows.filter((row) => !isVoid(row))

  const inForce = valid.filter((row) => isRentRowInForceOn(row, today))
  const upcoming = valid.filter((row) => !!row.from && row.from > today)
  const found =
    inForce.length > 0
      ? pickBy(inForce, (row) => row.from ?? '')
      : pickBy(upcoming, (row) => row.from ?? '', true)
  if (found) return openSuccessor(found, valid) ?? found

  // Every row left has a to-date before today, or is void.
  return pickBy(rows, (row) => row.to ?? '')
}

/**
 * Whether the lease has a home insurance row that is open-ended or has not
 * started yet. Adding home insurance next to such a row would bill it twice.
 */
export const hasOpenOrUpcomingHomeInsuranceRow = (
  hyror: TenfastInvoiceRow[],
  articleId: string,
  today: string = toSwedishDay(new Date())
): boolean =>
  hyror.some(
    (row) =>
      isInsuranceRow(row, articleId) &&
      !isVoid(row) &&
      (row.to == null || (!!row.from && row.from > today))
  )

export type HomeInsuranceReplacementRow = Omit<TenfastInvoiceRow, '_id'>

export type HomeInsuranceEndPlan =
  | { kind: 'delete' }
  | { kind: 'replace'; row: HomeInsuranceReplacementRow }
  | { kind: 'error'; error: 'end-date-before-start' | 'end-date-unchanged' }

/**
 * The row with a new last day. includeInContract is copied: Tenfast sets it
 * to false on a row sent without it (checked against Tenfast test), which
 * would take a row that counts in the rent total out of it.
 */
export const withEndDate = (
  row: TenfastInvoiceRow,
  to: YearMonthDayString
): HomeInsuranceReplacementRow => ({
  amount: row.amount,
  vat: row.vat,
  article: row.article,
  label: row.label,
  from: row.from ?? undefined,
  to,
  ...(row.includeInContract == null
    ? {}
    : { includeInContract: row.includeInContract }),
})

/**
 * How to end a home insurance row on endDate (yyyy-mm-dd, the last day in
 * force). Days are compared as yyyy-mm-dd strings, never as Dates, so no time
 * zone can move them.
 *
 * - cancel: an end on or before the first day removes the row, since the
 *   insurance then never runs. Any other end replaces the row with one that
 *   ends on endDate.
 * - set-end: the row is replaced with one that ends on endDate, which may
 *   not be before the first day.
 *
 * A row without a first day has no lower bound. Ending a row on the day it
 * already ends is refused rather than written again.
 */
export const planHomeInsuranceEnd = (
  row: TenfastInvoiceRow,
  endDate: YearMonthDayString,
  action: leasing.HomeInsuranceEndAction
): HomeInsuranceEndPlan => {
  if (action === 'cancel' && row.from && endDate <= row.from) {
    return { kind: 'delete' }
  }
  if (action === 'set-end' && row.from && endDate < row.from) {
    return { kind: 'error', error: 'end-date-before-start' }
  }
  if (row.to === endDate) {
    return { kind: 'error', error: 'end-date-unchanged' }
  }

  return { kind: 'replace', row: withEndDate(row, endDate) }
}

export type HomeInsuranceCancelPlan = {
  // The rows the write removes: the row it ends, and every row that would
  // start after the new last day.
  rowsToDelete: string[]
  written: HomeInsuranceReplacementRow
}

/**
 * How to end the home insurance on endDate for the tenant (Mina sidor). The
 * row in force on endDate gets endDate as its last day, and every row that
 * would start after that day is removed, so a row that takes over later, such
 * as after a price change, does not go on billing. Without a row in force on
 * endDate, the first row to start after it is ended on its own first day
 * instead: the lease always keeps one row, since Mina sidor shows a lease to
 * come without a home insurance row as insured. Without either, the row that
 * matters now (selectCurrentHomeInsuranceRow) is ended on endDate.
 *
 * Rows with a negative amount pay money back: they are neither ended nor
 * removed.
 *
 * Undefined when the lease has no home insurance row. Days are compared as
 * yyyy-mm-dd strings, never as Dates.
 */
export const planHomeInsuranceCancel = (
  hyror: TenfastInvoiceRow[],
  articleId: string,
  endDate: YearMonthDayString,
  today: string = toSwedishDay(new Date())
): HomeInsuranceCancelPlan | undefined => {
  const valid = hyror.filter(
    (row) => isInsuranceRow(row, articleId) && !isVoid(row)
  )

  const covering = valid.filter(
    (row) =>
      (!row.from || row.from <= endDate) &&
      (row.to == null || row.to >= endDate)
  )
  const after = valid.filter((row) => !!row.from && row.from > endDate)
  const kept =
    pickBy(covering, (row) => row.from ?? '') ??
    pickBy(after, (row) => row.from ?? '', true) ??
    selectCurrentHomeInsuranceRow(hyror, articleId, today)
  if (!kept) return undefined

  const to = kept.from && endDate < kept.from ? kept.from : endDate
  const later = valid.filter(
    (row) => row._id !== kept._id && !!row.from && row.from > to
  )

  return {
    rowsToDelete: [kept._id, ...later.map((row) => row._id)],
    written: withEndDate(kept, to),
  }
}

// What identifies a row's content, ignoring its _id, which Tenfast assigns.
const rowContentKey = (
  row: Pick<TenfastInvoiceRow, 'from' | 'to' | 'amount'>
) => `${row.from ?? ''}|${row.to ?? ''}|${row.amount}`

export type HomeInsuranceWriteCheck =
  | { ok: true; row: TenfastInvoiceRow | null }
  | {
      ok: false
      reason: 'old-row-still-present' | 'rows-differ'
      // The home insurance rows the lease holds now that it did not hold
      // before the write: this write's row and any row a write at the same
      // time added. Logged, so a duplicate can be found and removed.
      addedRowIds: string[]
    }

/**
 * Whether the lease, read again after a write to its home insurance rows,
 * holds exactly what the write meant: the removed rows gone, and the other
 * home insurance rows as they were before plus the written row (none on a
 * delete). Anything else means someone else changed the rows at the same
 * time, for example added a row, or Tenfast did not apply the write as sent.
 * Two writes on the same row cannot both get here: Tenfast refuses the whole
 * write with 400 when a row in rowsToDelete is gone (see
 * writeHomeInsuranceRows in the routes).
 *
 * On success, row is the written row as Tenfast stored it, with its new _id.
 */
export const checkHomeInsuranceWrite = (params: {
  rowsBefore: TenfastInvoiceRow[]
  rowsAfter: TenfastInvoiceRow[]
  articleId: string
  removedRowIds: string[]
  written: HomeInsuranceReplacementRow | null
}): HomeInsuranceWriteCheck => {
  const { articleId, written } = params
  const removed = new Set(params.removedRowIds)
  const before = params.rowsBefore.filter((row) => row.article === articleId)
  const after = params.rowsAfter.filter((row) => row.article === articleId)
  const beforeIds = new Set(before.map((row) => row._id))
  const addedRowIds = after
    .filter((row) => !beforeIds.has(row._id))
    .map((row) => row._id)

  if (after.some((row) => removed.has(row._id))) {
    return { ok: false, reason: 'old-row-still-present', addedRowIds }
  }

  const expectedKeys = before
    .filter((row) => !removed.has(row._id))
    .map(rowContentKey)
  if (written) expectedKeys.push(rowContentKey(written))
  const actualKeys = after.map(rowContentKey)

  expectedKeys.sort()
  actualKeys.sort()
  const same =
    expectedKeys.length === actualKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index])
  if (!same) return { ok: false, reason: 'rows-differ', addedRowIds }

  if (!written) return { ok: true, row: null }

  const writtenKey = rowContentKey(written)
  const matching = after.filter((row) => rowContentKey(row) === writtenKey)
  // Prefer the row Tenfast added. If it gave every row a new _id, any row
  // with the written content is the same row.
  const row =
    matching.find((candidate) => !beforeIds.has(candidate._id)) ?? matching[0]

  return { ok: true, row }
}

export const toHomeInsuranceRow = (
  row: TenfastInvoiceRow
): leasing.HomeInsuranceRow => ({
  rowId: row._id,
  monthlyAmount: row.amount,
  from: row.from ?? undefined,
  to: row.to ?? undefined,
})

/**
 * The row's status in the Länsförsäkringar file: * when the row has an end
 * date, else K on a lease to come, else G.
 */
export const homeInsuranceLfStatus = (
  row: TenfastInvoiceRow,
  lease: TenfastLease
): leasing.HomeInsuranceLfStatus =>
  row.to != null ? '*' : lease.stage === 'upcoming' ? 'K' : 'G'

/**
 * The tenant the home insurance is for: the first private tenant with a
 * personal identity number, as in the Länsförsäkringar file.
 */
export const findInsuredTenant = (
  lease: TenfastLease
): (TenfastTenant & { idbeteckning: string }) | undefined =>
  lease.hyresgaster.find(
    (tenant): tenant is TenfastTenant & { idbeteckning: string } =>
      !tenant.isCompany && !!tenant.idbeteckning
  )

/**
 * A home insurance row as an item of the staff list. tenant is the tenant to
 * show; only its contactCode and whether it is a company are carried, never
 * its name or personal identity number.
 */
export const toHomeInsuranceListItem = (
  lease: TenfastLease,
  row: TenfastInvoiceRow,
  tenant: TenfastTenant | undefined
): leasing.HomeInsuranceListItem => {
  const rentalObject = lease.hyresobjekt[0]
  return {
    leaseId: lease.externalId,
    leaseStatus: homeInsuranceLfStatus(row, lease),
    leaseStage: calculateLeaseStatus(lease),
    leaseFromDate: toSwedishDay(lease.startDate),
    leaseToDate: lease.endDate ? toSwedishDay(lease.endDate) : null,
    rentalObjectCode: rentalObject?.externalId ?? null,
    numberOfRooms: rentalObject?.roomCount ?? null,
    squareMeters:
      rentalObject?.kvm != null ? Math.round(rentalObject.kvm) : null,
    address: rentalObject?.postadress ?? null,
    postalCode: rentalObject?.postnummer ?? null,
    city: rentalObject?.stad ?? null,
    rowId: row._id,
    rowFromDate: row.from ?? null,
    rowToDate: row.to ?? null,
    monthlyAmount: row.amount,
    articleText: row.label ?? '',
    contactCode: tenant?.externalId ?? null,
    isCompany: tenant?.isCompany ?? false,
  }
}
