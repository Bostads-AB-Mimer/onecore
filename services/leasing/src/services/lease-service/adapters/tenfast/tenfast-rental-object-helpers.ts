import { RentalObjectAvailabilityInfo, RentalTag } from '@onecore/types'
import currency from 'currency.js'
import { logger } from '@onecore/utilities'
import { TenfastLease, TenfastRentalObject, TenfastTag } from './schemas'

// Lease stages (Tenfast's avtal.stage) in force: running, terminating with or
// without signed notice, or signed to start later.
const IN_FORCE_STAGES = new Set([
  'active',
  'terminationScheduled',
  'preTermination',
  'upcoming',
])
// Stages that never hold the object: ended, annulled or never signed.
const NOT_IN_FORCE_STAGES = new Set([
  'archived',
  'terminated',
  'voided',
  'rejected',
  'draft',
  'signingInProgress',
])

// The lease fields that decide whether a rental object is vacant. Leases are
// often parsed partially (on a rental object, or from a search without
// populate), so every field may be missing.
export type LeaseStageInfo = Partial<
  Pick<TenfastLease, 'externalId' | 'stage' | 'endDate'> & {
    cancellation: Partial<
      Pick<TenfastLease['cancellation'], 'requested' | 'cancelled'>
    >
  }
>

// Lease stages through which a next tenant has claimed the object: signed to
// start later, or not signed yet (a draft, or out for signing).
export const CLAIMING_STAGES = ['upcoming', 'draft', 'signingInProgress']

/**
 * Whether the lease claims the rental object for a next tenant, so the object
 * must not be offered again. A lease whose stage is missing or unknown counts
 * as claiming, so an object is never offered on a lease we can't read.
 */
export const isClaimingLease = (lease: {
  stage?: string
  externalId?: string
}): boolean => {
  if (lease.stage && CLAIMING_STAGES.includes(lease.stage)) return true
  if (
    lease.stage &&
    (IN_FORCE_STAGES.has(lease.stage) || NOT_IN_FORCE_STAGES.has(lease.stage))
  )
    return false

  logger.warn(
    { stage: lease.stage, leaseId: lease.externalId },
    'isClaimingLease: unknown lease stage, rental object counted as claimed'
  )
  return true
}

/**
 * When the leases in force (IN_FORCE_STAGES) leave the rental object: the
 * latest end date among them, null if there are none, or 'indefinite' if any
 * of them has no end. Without an end means a tenancy until further notice,
 * which includes a signed successor to a terminated lease: the object never
 * becomes vacant in between.
 *
 * Tenfast sets endDate when notice is given (and for fixed-term leases). A
 * notice that was withdrawn (`requested` and `cancelled`) counts as no end,
 * in case the end date is left behind. Leases on a rental object are parsed
 * partially, so stage and cancellation may be missing: a lease whose stage is
 * missing or unknown counts as in force without an end, so an object is never
 * shown as vacant on a lease we can't read.
 */
export const getLeasedUntil = (
  leases: LeaseStageInfo[]
): Date | null | 'indefinite' => {
  const endDates: Date[] = []
  for (const lease of leases) {
    if (lease.stage && NOT_IN_FORCE_STAGES.has(lease.stage)) continue
    if (!lease.stage || !IN_FORCE_STAGES.has(lease.stage)) {
      logger.warn(
        { stage: lease.stage, leaseId: lease.externalId },
        'getLeasedUntil: unknown lease stage, rental object counted as not vacant'
      )
      return 'indefinite'
    }

    const noticeWithdrawn =
      lease.cancellation?.requested && lease.cancellation?.cancelled
    if (!lease.endDate || noticeWithdrawn) return 'indefinite'
    endDates.push(new Date(lease.endDate))
  }
  if (endDates.length === 0) return null

  return new Date(Math.max(...endDates.map((date) => date.getTime())))
}

/**
 * The first day the rental object is free for a new lease (UTC midnight), or
 * undefined if it is not vacant at all: leased until further notice, or
 * claimed by a next tenant (see isClaimingLease).
 */
export const getVacantFrom = (leases: LeaseStageInfo[]): Date | undefined => {
  if (leases.some(isClaimingLease)) return undefined

  const leasedUntil = getLeasedUntil(leases)
  if (leasedUntil === 'indefinite') return undefined

  if (leasedUntil) {
    // Vacant the day after the last lease ends.
    const vacantFrom = new Date(leasedUntil)
    vacantFrom.setUTCDate(vacantFrom.getUTCDate() + 1)
    vacantFrom.setUTCHours(0, 0, 0, 0)
    return vacantFrom
  }

  // No lease running or to come: vacant as of today.
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today
}

export const mapTenfastRentalObjectToAvailabilityInfo = (
  includeVAT: boolean,
  tenfastRentalObject: TenfastRentalObject,
  tagsById: Map<string, TenfastTag> = new Map()
): RentalObjectAvailabilityInfo => {
  const vacantFrom = getVacantFrom(tenfastRentalObject.avtal ?? [])

  return {
    rentalObjectCode: tenfastRentalObject.externalId,
    vacantFrom: vacantFrom,
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
