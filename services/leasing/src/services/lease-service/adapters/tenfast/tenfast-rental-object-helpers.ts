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
  leases: TenfastLease[]
): Date | null | 'indefinite' => {
  const endDates: Date[] = []
  for (const lease of leases) {
    if (NOT_IN_FORCE_STAGES.has(lease.stage)) continue
    if (!IN_FORCE_STAGES.has(lease.stage)) {
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

export const mapTenfastRentalObjectToAvailabilityInfo = (
  includeVAT: boolean,
  tenfastRentalObject: TenfastRentalObject,
  tagsById: Map<string, TenfastTag> = new Map()
): RentalObjectAvailabilityInfo => {
  const leasedUntil = getLeasedUntil(tenfastRentalObject.avtal ?? [])

  // undefined: leased until further notice, so not vacant at all.
  let vacantFrom: Date | undefined
  if (leasedUntil === 'indefinite') {
    vacantFrom = undefined
  } else if (leasedUntil) {
    // Vacant the day after the last lease ends.
    vacantFrom = new Date(leasedUntil)
    vacantFrom.setUTCDate(vacantFrom.getUTCDate() + 1)
    vacantFrom.setUTCHours(0, 0, 0, 0)
  } else {
    // No lease running or to come: vacant as of today.
    vacantFrom = new Date()
    vacantFrom.setUTCHours(0, 0, 0, 0)
  }

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
        code: hyra.article ?? '',
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
