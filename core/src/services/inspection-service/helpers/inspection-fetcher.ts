import * as inspectionAdapter from '../../../adapters/inspection-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'
import { mapLease } from '../../lease-service/schemas/lease'
import * as schemas from '../schemas'

type FetchEnrichedInspectionResult =
  | { ok: true; data: schemas.DetailedInspection }
  | { ok: false; err: string; statusCode: number }

/**
 * Fetches an inspection by ID and enriches it with lease and residence data.
 * Shared helper function used by multiple endpoints to avoid code duplication.
 *
 * @param inspectionId - The ID of the inspection to fetch
 * @returns Enriched inspection with lease and residence data, or error result
 */
export const fetchEnrichedInspection = async (
  inspectionId: string
): Promise<FetchEnrichedInspectionResult> => {
  const result = await inspectionAdapter.getXpandInspectionById(inspectionId)

  if (!result.ok) {
    return {
      ok: false,
      err: result.err,
      statusCode: result.statusCode || 500,
    }
  }

  const rawInspection = result.data

  // Fetch lease data if available
  let lease = null
  if (rawInspection.leaseId) {
    const rawLease = await leasingAdapter.getLease(rawInspection.leaseId, 'true')
    lease = mapLease(rawLease)
  }

  // Fetch residence data if available
  let residence = null
  if (rawInspection.residenceId) {
    const res = await propertyBaseAdapter.getResidenceByRentalId(
      rawInspection.residenceId
    )
    if (res.ok) {
      residence = res.data
    }
  }

  // Validate inspection data from Xpand
  const validatedInspection =
    schemas.DetailedXpandInspectionSchema.parse(rawInspection)

  // Combine into enriched inspection
  const inspection: schemas.DetailedInspection = {
    ...validatedInspection,
    lease,
    residence,
  }

  return { ok: true, data: inspection }
}
