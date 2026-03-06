import { sub } from 'date-fns'
import { LeaseStatus } from '@onecore/types'

import { mapToOnecoreLease } from '../../helpers/tenfast'
import * as factory from '../factories'

describe('calculateLeaseStatus (via mapToOnecoreLease)', () => {
  it('returns PendingSignature for Inväntar signering stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'Inväntar signering',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.PendingSignature)
  })

  it('returns NotSent for Ej skickat stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'Ej skickat',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.NotSent)
  })

  it('returns PreliminaryTerminated for Preliminärt uppsagt stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'Preliminärt uppsagt',
    })

    expect(mapToOnecoreLease(lease).status).toBe(
      LeaseStatus.PreliminaryTerminated
    )
  })

  it('returns Ended for Upphört stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'Upphört',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Ended)
  })

  it('returns AboutToEnd for Uppsagt stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'Uppsagt',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.AboutToEnd)
  })

  it('returns Upcoming for Kommande stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'Kommande',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Upcoming)
  })

  it('returns Current for Gällande stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'Gällande',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Current)
  })

  it('returns Current as fallback for unexpected stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'unknownStage',
      signed: false,
      startDate: sub(new Date(), { days: 30 }),
      endDate: null,
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Current)
  })
})
