import { sub } from 'date-fns'
import { LeaseStatus, LeaseType } from '@onecore/types'

import { mapToOnecoreLease } from '../../helpers/tenfast'
import * as factory from '../factories'
import { TenfastRentalObjectFactory } from '../factories/tenfast-rental-object'

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

describe('mapTenfastTypToLeaseType (via mapToOnecoreLease)', () => {
  it.each([
    ['bostad', LeaseType.HousingContract],
    ['parkering', LeaseType.ParkingSpaceContract],
    ['lokal', LeaseType.CommercialTenantContract],
    ['garage', LeaseType.GarageContract],
    ['forrad', LeaseType.StorageContract],
    ['ovrigt', LeaseType.OtherContract],
  ])('maps "%s" to %s', (typ, expected) => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [TenfastRentalObjectFactory.build({ typ })],
    })

    expect(mapToOnecoreLease(lease).type).toBe(expected)
  })

  it('handles uppercase casing', () => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [TenfastRentalObjectFactory.build({ typ: 'Bostad' })],
    })

    expect(mapToOnecoreLease(lease).type).toBe(LeaseType.HousingContract)
  })

  it('falls back to OtherContract for unknown typ', () => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [TenfastRentalObjectFactory.build({ typ: 'unknown' })],
    })

    expect(mapToOnecoreLease(lease).type).toBe(LeaseType.OtherContract)
  })

  it('falls back to OtherContract when typ is undefined', () => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [TenfastRentalObjectFactory.build({ typ: undefined })],
    })

    expect(mapToOnecoreLease(lease).type).toBe(LeaseType.OtherContract)
  })

  it('falls back to OtherContract when hyresobjekt is empty', () => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [],
    })

    expect(mapToOnecoreLease(lease).type).toBe(LeaseType.OtherContract)
  })
})
