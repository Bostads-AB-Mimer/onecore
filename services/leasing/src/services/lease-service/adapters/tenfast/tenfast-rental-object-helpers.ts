import { RentalObjectAvailabilityInfo, RentalTag } from '@onecore/types'
import currency from 'currency.js'
import { TenfastLease, TenfastRentalObject, TenfastTag } from './schemas'

const startOfUtcDay = (d: Date) => {
  const copy = new Date(d)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

// Never a tenancy: not signed, or annulled. Same set economy skips on this data.
const NON_TENANCY_STAGES = new Set([
  'draft',
  'signingInProgress',
  'voided',
  'rejected',
])

/** The latest lease that has begun, i.e. the object's current (or last) tenancy. */
export const getLatestStartedLease = (
  leases: TenfastLease[],
  today: Date = new Date()
): TenfastLease | null =>
  leases
    .filter(
      (lease) =>
        !NON_TENANCY_STAGES.has(lease.stage) &&
        lease.startDate != null &&
        lease.startDate <= today
    )
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null

/** Start of the current tenancy; listing history before it belongs to an earlier one. */
// Nothing is published during a tenancy, so this counts the same rounds as the
// notice date would, and it also covers fixed-term leases that end without notice.
export const getLatestTenancyCutoff = (leases: TenfastLease[]): Date | null =>
  getLatestStartedLease(leases)?.startDate ?? null

/** When the current tenancy ends: its end date, fixed-term or notice alike.
 * The cancellation object describes the notice; the lease's endDate is the lease's. */
export const getCurrentTenancyEndDate = (leases: TenfastLease[]): Date | null =>
  getLatestStartedLease(leases)?.endDate ?? null

export const mapTenfastRentalObjectToAvailabilityInfo = (
  includeVAT: boolean,
  tenfastRentalObject: TenfastRentalObject,
  tagsById: Map<string, TenfastTag> = new Map()
): RentalObjectAvailabilityInfo => {
  const leases = tenfastRentalObject.avtal ?? []
  const today = startOfUtcDay(new Date())
  const endDate = getCurrentTenancyEndDate(leases)

  // The day after the tenancy ends, never earlier than today (a tenancy that
  // already ended means the object is vacant now). Blocks are applied by callers.
  let vacantFrom = today
  if (endDate) {
    const dayAfter = startOfUtcDay(endDate)
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1)
    if (dayAfter > today) vacantFrom = dayAfter
  }

  return {
    rentalObjectCode: tenfastRentalObject.externalId,
    vacantFrom: vacantFrom,
    listingHistorySince: getLatestTenancyCutoff(leases),
    rentalTenureType: {
      id: tenfastRentalObject.category.code,
      name: tenfastRentalObject.category.label,
    },
    rentalTags: tenfastRentalObject.tags?.flatMap((id): RentalTag[] => {
      const tag = tagsById.get(id)
      return tag ? [{ id: tag.code, name: tag.name }] : []
    }),
    rent: {
      amount: includeVAT
        ? (tenfastRentalObject.hyra ?? 0)
        : (tenfastRentalObject.hyraExcludingVat ?? 0),
      vat: includeVAT ? (tenfastRentalObject.hyraVat ?? 0) : 0,
      rows: (tenfastRentalObject.hyror ?? []).map((hyra) => ({
        description: hyra.label || '',
        amount: includeVAT
          ? currency(hyra.amount).add(hyra.vat).value
          : hyra.amount,
        vatPercentage: includeVAT ? hyra.vat : 0,
        fromDate: hyra.from != undefined ? new Date(hyra.from) : undefined,
        toDate: hyra.to != undefined ? new Date(hyra.to) : undefined,
      })),
    },
  }
}
