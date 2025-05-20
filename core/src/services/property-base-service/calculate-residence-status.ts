import { Lease, LeaseStatus } from 'onecore-types'
import { z } from 'zod'

import * as schemas from './schemas'

type ResidenceStatus = NonNullable<
  z.infer<typeof schemas.ResidenceDetailsSchema>['status']
>

export function calculateResidenceStatus(leases: Lease[]): ResidenceStatus {
  const leased = leases.some((lease) =>
    [
      LeaseStatus.Current,
      LeaseStatus.Upcoming,
      LeaseStatus.AboutToEnd,
    ].includes(lease.status)
  )

  if (leased) {
    return 'LEASED'
  }

  return 'VACANT'
}
