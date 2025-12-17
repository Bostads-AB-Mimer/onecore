import { add, sub } from 'date-fns'

import { filterByStatus } from '../../../adapters/tenfast/filters'
import * as factory from '../../factories'

describe(filterByStatus, () => {
  it('filters leases by status', () => {
    const currentLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: null,
    })
    const upcomingLease = factory.tenfastLease.build({
      startDate: add(new Date(), { days: 1 }),
      endDate: null,
    })
    const aboutToEndLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: add(new Date(), { days: 1 }),
      cancellation: { cancelled: true },
    })
    const endedLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: sub(new Date(), { days: 1 }),
    })

    const leases = [currentLease, upcomingLease, aboutToEndLease, endedLease]

    expect(filterByStatus(leases, ['current'])).toEqual([currentLease])
    expect(filterByStatus(leases, ['upcoming'])).toEqual([upcomingLease])
    expect(filterByStatus(leases, ['about-to-end'])).toEqual([aboutToEndLease])
    expect(filterByStatus(leases, ['ended'])).toEqual([endedLease])
  })
})
