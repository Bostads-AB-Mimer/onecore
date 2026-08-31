import { logger } from '@onecore/utilities'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { XpandInspection } from '../../../adapters/inspection-adapter'
import { InspectionSource, INSPECTION_SOURCE } from '../schemas'

export function logSourceError(
  result: PromiseSettledResult<{ ok: boolean }>,
  message: string,
  context?: Record<string, unknown>
) {
  if (
    result.status === 'rejected' ||
    (result.status === 'fulfilled' && !result.value.ok)
  ) {
    logger.error(
      {
        err: result.status === 'fulfilled' ? result.value : result.reason,
        ...context,
      },
      message
    )
  }
}

export async function tagAndEnrichInspections(
  internalInspections: XpandInspection[],
  xpandInspections: XpandInspection[]
) {
  const allInspections = [
    ...internalInspections.map((i) => ({
      ...i,
      source: INSPECTION_SOURCE.INTERNAL as InspectionSource,
    })),
    ...xpandInspections.map((i) => ({
      ...i,
      source: INSPECTION_SOURCE.XPAND as InspectionSource,
    })),
  ]

  const leaseIds = allInspections
    .filter((i) => i.leaseId !== null && i.leaseId !== '')
    .map((i) => i.leaseId)

  const leasesById =
    leaseIds.length > 0 ? await leasingAdapter.getLeases(leaseIds, 'true') : {}

  return allInspections.map((inspection) => ({
    ...inspection,
    lease: inspection.leaseId ? (leasesById[inspection.leaseId] ?? null) : null,
  }))
}
