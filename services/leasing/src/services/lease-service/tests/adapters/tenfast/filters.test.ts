import { filterByStatus } from '../../../adapters/tenfast/filters'
import * as factory from '../../factories'

describe(filterByStatus, () => {
  it('filters leases by status', () => {
    const currentLease = factory.tenfastLease.build({ stage: 'Gällande' })
    const upcomingLease = factory.tenfastLease.build({ stage: 'Kommande' })
    const aboutToEndLease = factory.tenfastLease.build({ stage: 'Uppsagt' })
    const preliminaryTerminatedLease = factory.tenfastLease.build({
      stage: 'Preliminärt uppsagt',
    })
    const endedLease = factory.tenfastLease.build({ stage: 'Upphört' })
    const pendingSignatureLease = factory.tenfastLease.build({
      stage: 'Inväntar signering',
    })
    const notSentLease = factory.tenfastLease.build({ stage: 'Ej skickat' })

    const leases = [
      currentLease,
      upcomingLease,
      aboutToEndLease,
      preliminaryTerminatedLease,
      endedLease,
      pendingSignatureLease,
      notSentLease,
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
    expect(filterByStatus(leases, ['not-sent'])).toEqual([notSentLease])
  })

  it('filters leases by multiple statuses', () => {
    const upcomingLease = factory.tenfastLease.build({ stage: 'Kommande' })
    const currentLease = factory.tenfastLease.build({ stage: 'Gällande' })
    const endedLease = factory.tenfastLease.build({ stage: 'Upphört' })

    const leases = [upcomingLease, currentLease, endedLease]

    const result = filterByStatus(leases, ['upcoming', 'current'])

    expect(result).toEqual([upcomingLease, currentLease])
  })
})
