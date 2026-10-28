import { logger } from '@onecore/utilities'

import { TenfastLease } from './schemas'

export type GetLeasesFilters = {
  status: (
    | 'current'
    | 'upcoming'
    | 'about-to-end'
    | 'ended'
    | 'preliminary-terminated'
    | 'pending-signature'
    | 'not-sent'
    | 'voided'
  )[]
}

const stageToStatus: Record<string, GetLeasesFilters['status'][number]> = {
  active: 'current',
  upcoming: 'upcoming',
  terminationScheduled: 'about-to-end',
  archived: 'ended',
  terminated: 'ended',
  preTermination: 'preliminary-terminated',
  signingInProgress: 'pending-signature',
  draft: 'not-sent',
  voided: 'voided',
}

export const filterByStatus = (
  leases: TenfastLease[],
  statuses: GetLeasesFilters['status']
) => {
  return leases.filter((l) => {
    const mappedStatus = stageToStatus[l.stage]
    if (!mappedStatus) {
      logger.warn(
        { stage: l.stage, leaseId: l.externalId },
        'filterByStatus: Unknown Tenfast stage, lease excluded from results'
      )
      return false
    }
    return statuses.includes(mappedStatus)
  })
}
