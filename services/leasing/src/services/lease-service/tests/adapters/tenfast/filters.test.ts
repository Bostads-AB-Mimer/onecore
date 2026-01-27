import { add, sub } from 'date-fns'

import { filterByStatus } from '../../../adapters/tenfast/filters'
import * as factory from '../../factories'

describe(filterByStatus, () => {
  it('filters leases by status', () => {
    const currentLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: null,
      cancellation: {
        cancelled: false,
        doneAutomatically: false,
        receivedCancellationAt: null,
        notifiedAt: null,
        handledAt: null,
        handledBy: null,
        preferredMoveOutDate: null,
      },
      simplesignTermination: undefined,
    })
    const upcomingLease = factory.tenfastLease.build({
      startDate: add(new Date(), { days: 1 }),
      endDate: null,
    })
    const aboutToEndLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: add(new Date(), { days: 1 }),
      cancellation: {
        cancelled: true,
        doneAutomatically: false,
        receivedCancellationAt: null,
        notifiedAt: null,
        handledAt: new Date(),
        handledBy: 'admin-user-id',
        preferredMoveOutDate: null,
      },
      simplesignTermination: undefined,
    })
    const preliminaryTerminatedLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: add(new Date(), { days: 30 }),
      cancellation: {
        cancelled: false,
        doneAutomatically: false,
        receivedCancellationAt: null,
        notifiedAt: null,
        handledAt: null,
        handledBy: null,
        preferredMoveOutDate: null,
      },
      simplesignTermination: {
        signatures: [],
        sentAt: new Date(),
        signedAt: null,
      },
    })
    const endedLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: sub(new Date(), { days: 1 }),
    })

    const leases = [
      currentLease,
      upcomingLease,
      aboutToEndLease,
      preliminaryTerminatedLease,
      endedLease,
    ]

    expect(filterByStatus(leases, ['current'])).toEqual([currentLease])
    expect(filterByStatus(leases, ['upcoming'])).toEqual([upcomingLease])
    expect(filterByStatus(leases, ['about-to-end'])).toEqual([aboutToEndLease])
    expect(filterByStatus(leases, ['preliminary-terminated'])).toEqual([
      preliminaryTerminatedLease,
    ])
    expect(filterByStatus(leases, ['ended'])).toEqual([endedLease])
  })
})
