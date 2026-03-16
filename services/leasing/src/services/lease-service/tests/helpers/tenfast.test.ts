import { sub } from 'date-fns'
import { LeaseStatus } from '@onecore/types'

import { mapToOnecoreLease } from '../../helpers/tenfast'
import * as factory from '../factories'

describe('calculateLeaseStatus (via mapToOnecoreLease)', () => {
  it('returns PendingSignature for signingInProgress stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'signingInProgress',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.PendingSignature)
  })

  it('returns NotSent for draft stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'draft',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.NotSent)
  })

  it('returns PreliminaryTerminated for preTermination stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'preTermination',
    })

    expect(mapToOnecoreLease(lease).status).toBe(
      LeaseStatus.PreliminaryTerminated
    )
  })

  it('returns Ended for archived stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'archived',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Ended)
  })

  it('returns Ended for terminated stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'terminated',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Ended)
  })

  it('returns AboutToEnd for terminationScheduled stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'terminationScheduled',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.AboutToEnd)
  })

  it('returns Upcoming for upcoming stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'upcoming',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Upcoming)
  })

  it('returns Current for active stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'active',
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Current)
  })

  it('returns Ended as fallback for unexpected stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'unknownStage',
      signed: false,
      startDate: sub(new Date(), { days: 30 }),
      endDate: null,
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Ended)
  })
})
