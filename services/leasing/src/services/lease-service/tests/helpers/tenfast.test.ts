import { add, sub } from 'date-fns'
import { LeaseStatus } from '@onecore/types'

import { mapToOnecoreLease } from '../../helpers/tenfast'
import * as factory from '../factories'

describe('calculateLeaseStatus (via mapToOnecoreLease)', () => {
  it('returns PendingSignature for signingInProgress stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'signingInProgress',
      signed: false,
      startDate: sub(new Date(), { days: 1 }),
      endDate: null,
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.PendingSignature)
  })

  it('returns PreliminaryTerminated for requestedCancellation stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'requestedCancellation',
      signed: true,
      startDate: sub(new Date(), { days: 30 }),
      endDate: add(new Date(), { days: 30 }),
    })

    expect(mapToOnecoreLease(lease).status).toBe(
      LeaseStatus.PreliminaryTerminated
    )
  })

  it('returns PreliminaryTerminated for preliminaryCancellation stage', () => {
    const lease = factory.tenfastLease.build({
      stage: 'preliminaryCancellation',
      signed: true,
      startDate: sub(new Date(), { days: 30 }),
      endDate: add(new Date(), { days: 30 }),
    })

    expect(mapToOnecoreLease(lease).status).toBe(
      LeaseStatus.PreliminaryTerminated
    )
  })

  it('returns Ended for cancelled lease with past end date', () => {
    const lease = factory.tenfastLease.build({
      stage: 'cancelled',
      signed: true,
      startDate: sub(new Date(), { days: 60 }),
      endDate: sub(new Date(), { days: 1 }),
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Ended)
  })

  it('returns Ended for archived lease with past end date', () => {
    const lease = factory.tenfastLease.build({
      stage: 'archived',
      signed: true,
      startDate: sub(new Date(), { days: 60 }),
      endDate: sub(new Date(), { days: 1 }),
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Ended)
  })

  it('returns AboutToEnd for lease with future end date', () => {
    const lease = factory.tenfastLease.build({
      stage: 'cancelled',
      signed: true,
      startDate: sub(new Date(), { days: 30 }),
      endDate: add(new Date(), { days: 30 }),
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.AboutToEnd)
  })

  it('returns Upcoming for signed lease with future start date', () => {
    const lease = factory.tenfastLease.build({
      stage: 'signed',
      signed: true,
      startDate: add(new Date(), { days: 1 }),
      endDate: null,
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.Upcoming)
  })

  it('returns Current for signed lease with past start date and no end date', () => {
    const lease = factory.tenfastLease.build({
      stage: 'signed',
      signed: true,
      startDate: sub(new Date(), { days: 30 }),
      endDate: null,
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

  it('prioritizes PendingSignature over other statuses', () => {
    // A signingInProgress lease with a future end date could match AboutToEnd,
    // but PendingSignature should take priority
    const lease = factory.tenfastLease.build({
      stage: 'signingInProgress',
      signed: false,
      startDate: sub(new Date(), { days: 1 }),
      endDate: add(new Date(), { days: 30 }),
    })

    expect(mapToOnecoreLease(lease).status).toBe(LeaseStatus.PendingSignature)
  })

  it('prioritizes PreliminaryTerminated over AboutToEnd', () => {
    // A requestedCancellation lease with a future end date could match AboutToEnd,
    // but PreliminaryTerminated should take priority
    const lease = factory.tenfastLease.build({
      stage: 'requestedCancellation',
      signed: true,
      startDate: sub(new Date(), { days: 1 }),
      endDate: add(new Date(), { days: 30 }),
    })

    expect(mapToOnecoreLease(lease).status).toBe(
      LeaseStatus.PreliminaryTerminated
    )
  })
})
