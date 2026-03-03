import { add, sub } from 'date-fns'

import { filterByStatus } from '../../../adapters/tenfast/filters'
import * as factory from '../../factories'

describe(filterByStatus, () => {
  it('filters leases by status', () => {
    const currentLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: null,
      stage: 'signed',
      signed: true,
    })
    const upcomingLease = factory.tenfastLease.build({
      startDate: add(new Date(), { days: 1 }),
      endDate: null,
      stage: 'signed',
      signed: true,
    })
    const aboutToEndLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: add(new Date(), { days: 1 }),
      stage: 'cancelled',
      signed: true,
    })
    const preliminaryTerminatedLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: add(new Date(), { days: 30 }),
      stage: 'requestedCancellation',
      signed: true,
    })
    const endedLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: sub(new Date(), { days: 1 }),
      stage: 'cancelled',
      signed: true,
    })
    const pendingSignatureLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: null,
      stage: 'signingInProgress',
      signed: false,
    })

    const leases = [
      currentLease,
      upcomingLease,
      aboutToEndLease,
      preliminaryTerminatedLease,
      endedLease,
      pendingSignatureLease,
    ]

    expect(filterByStatus(leases, ['current'])).toEqual([currentLease])
    expect(filterByStatus(leases, ['upcoming'])).toEqual([upcomingLease])
    expect(filterByStatus(leases, ['about-to-end'])).toEqual([aboutToEndLease])
    expect(filterByStatus(leases, ['preliminary-terminated'])).toEqual([
      preliminaryTerminatedLease,
    ])
    expect(filterByStatus(leases, ['ended'])).toEqual([endedLease])
    expect(filterByStatus(leases, ['pending-signature'])).toEqual([
      pendingSignatureLease,
    ])
  })

  it('filters leases by multiple statuses without duplicates', () => {
    // A signed lease with future start and future end matches both
    // 'upcoming' (future startDate + signed) and 'about-to-end' (future endDate)
    const overlappingLease = factory.tenfastLease.build({
      startDate: add(new Date(), { days: 1 }),
      endDate: add(new Date(), { days: 30 }),
      stage: 'signed',
      signed: true,
    })

    const currentLease = factory.tenfastLease.build({
      startDate: sub(new Date(), { days: 1 }),
      endDate: null,
      stage: 'signed',
      signed: true,
    })

    const leases = [overlappingLease, currentLease]

    // overlappingLease matches 'upcoming' first, so it should not appear again for 'about-to-end'
    const result = filterByStatus(leases, [
      'upcoming',
      'about-to-end',
      'current',
    ])

    expect(result).toEqual([overlappingLease, currentLease])
  })
})
