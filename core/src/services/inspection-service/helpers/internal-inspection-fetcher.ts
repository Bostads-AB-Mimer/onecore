import { inspection } from '@onecore/types'
import { logger } from '@onecore/utilities'

import * as inspectionAdapter from '../../../adapters/inspection-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import type { components as propertyBaseComponents } from '../../../adapters/property-base-adapter/generated/api-types'
import { mapLease } from '../../lease-service/schemas/lease'
import { ResidenceDetailsSchema } from '../../property-base-service/schemas'
import * as schemas from '../schemas'
import { mapInternalRoomsToProtocolRooms } from './internal-inspection-normalizer'

type PropertyBaseRoom = propertyBaseComponents['schemas']['Room']

type FetchEnrichedInternalInspectionResult =
  | { ok: true; data: schemas.DetailedInspection }
  | { ok: false; err: string; statusCode: number }

/**
 * Internal-source counterpart to fetchEnrichedInspection.
 *
 * Loads an internal inspection, enriches it with lease + residence + property-
 * base room metadata, and reshapes it into the DetailedInspection (xpand) shape
 * the PDF generator and the existing frontend modal already understand.
 *
 * Internal inspections lack several fields the xpand schema carries
 * (`startedAt`, `endedAt`, `notes`, `isTenantPresent`, `isNewTenantPresent`,
 * `totalCost`, `remarkCount`, `hasRemarks`). We synthesize defaults for the
 * presence flags and notes; cost-/count-aggregates are derived from the
 * normalized remarks.
 */
export const fetchEnrichedInternalInspection = async (
  inspectionId: string
): Promise<FetchEnrichedInternalInspectionResult> => {
  const result = await inspectionAdapter.getInternalInspectionById(inspectionId)

  if (!result.ok) {
    return {
      ok: false,
      err: result.err,
      statusCode: result.statusCode || 500,
    }
  }

  const rawInspection = result.data

  // Lease lookup is best-effort: a deleted-but-referenced lease should not
  // 500 the entire details/PDF/send-protocol flow. Mirrors the residence
  // fallback below.
  let lease = null
  if (rawInspection.leaseId) {
    try {
      const rawLease = await leasingAdapter.getLease(
        rawInspection.leaseId,
        'true'
      )
      lease = mapLease(rawLease)
    } catch (err) {
      logger.error(
        { err, leaseId: rawInspection.leaseId },
        'fetchEnrichedInternalInspection.getLease'
      )
    }
  }

  let residence = null
  if (rawInspection.residenceId) {
    const res = await propertyBaseAdapter.getResidenceByRentalId(
      rawInspection.residenceId
    )
    if (res.ok) {
      residence = ResidenceDetailsSchema.parse({ ...res.data, status: null })
    }
  }

  // Validate the adapter response so downstream typing matches the Zod-inferred
  // shape (defaults applied) the normalizer expects.
  const validated = inspection.InternalInspectionSchema.parse(rawInspection)

  // Property-base rooms feed the room-name resolver in the normalizer.
  // A missing list isn't fatal — the normalizer falls back to roomId.
  let propertyBaseRooms: PropertyBaseRoom[] = []
  const roomsResult = await propertyBaseAdapter.getRooms(validated.residenceId)
  if (roomsResult.ok) {
    propertyBaseRooms = roomsResult.data
  }

  const rooms = mapInternalRoomsToProtocolRooms(
    validated.rooms ?? [],
    propertyBaseRooms
  )

  // Aggregates are derived from the normalized (filtered) rooms rather than
  // read off the inspection row. The DB stores them at create time and
  // saveInspectionDraft does not recompute them when remarks are added later,
  // so the stored values are stale for any inspection past the create step.
  const totalCost = rooms.reduce(
    (sum, room) =>
      sum + room.remarks.reduce((roomSum, r) => roomSum + r.cost, 0),
    0
  )
  const remarkCount = rooms.reduce((sum, room) => sum + room.remarks.length, 0)

  const enrichedInspection: schemas.DetailedInspection = {
    id: validated.id,
    status: validated.status,
    date: validated.date,
    startedAt: validated.startedAt,
    endedAt: validated.endedAt,
    inspector: validated.inspector,
    type: validated.type,
    residenceId: validated.residenceId,
    address: validated.address,
    apartmentCode: validated.apartmentCode,
    isFurnished: validated.isFurnished,
    leaseId: validated.leaseId,
    isTenantPresent: validated.isTenantPresent,
    isNewTenantPresent: validated.isNewTenantPresent,
    masterKeyAccess: validated.masterKeyAccess,
    hasRemarks: remarkCount > 0,
    notes: validated.notes,
    totalCost,
    remarkCount,
    rooms,
    lease,
    residence,
    componentWriteBackErrors: [],
  }

  return { ok: true, data: enrichedInspection }
}
