import { filterByStatus } from '../../../adapters/tenfast/filters'
import * as factory from '../../factories'

describe(filterByStatus, () => {
  it('filters leases by status', () => {
    const currentLease = factory.tenfastLease.build({ stage: 'active' })
    const upcomingLease = factory.tenfastLease.build({ stage: 'upcoming' })
    const aboutToEndLease = factory.tenfastLease.build({ stage: 'terminationScheduled' })
    const preliminaryTerminatedLease = factory.tenfastLease.build({
      stage: 'preTermination',
    })
    const archivedLease = factory.tenfastLease.build({ stage: 'archived' })
    const terminatedLease = factory.tenfastLease.build({ stage: 'terminated' })
    const pendingSignatureLease = factory.tenfastLease.build({
      stage: 'signingInProgress',
    })
    const notSentLease = factory.tenfastLease.build({ stage: 'draft' })

    const leases = [
      currentLease,
      upcomingLease,
      aboutToEndLease,
      preliminaryTerminatedLease,
      archivedLease,
      terminatedLease,
      pendingSignatureLease,
      notSentLease,
    ]

    expect(filterByStatus(leases, ['current'])).toEqual([currentLease])
    expect(filterByStatus(leases, ['upcoming'])).toEqual([upcomingLease])
    expect(filterByStatus(leases, ['about-to-end'])).toEqual([aboutToEndLease])
    expect(filterByStatus(leases, ['preliminary-terminated'])).toEqual([
      preliminaryTerminatedLease,
    ])
    expect(filterByStatus(leases, ['ended'])).toEqual([archivedLease, terminatedLease])
    expect(filterByStatus(leases, ['pending-signature'])).toEqual([
      pendingSignatureLease,
    ])
    expect(filterByStatus(leases, ['not-sent'])).toEqual([notSentLease])
  })

  it('filters leases by multiple statuses', () => {
    const upcomingLease = factory.tenfastLease.build({ stage: 'upcoming' })
    const currentLease = factory.tenfastLease.build({ stage: 'active' })
    const endedLease = factory.tenfastLease.build({ stage: 'archived' })

    const leases = [upcomingLease, currentLease, endedLease]

    const result = filterByStatus(leases, ['upcoming', 'current'])

    expect(result).toEqual([upcomingLease, currentLease])
  })
})
