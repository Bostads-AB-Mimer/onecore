import { sub } from 'date-fns'
import { LeaseStatus, LeaseType } from '@onecore/types'
import { logger } from '@onecore/utilities'

import config from '../../../../common/config'
import {
  buildTenfastLeaseUrl,
  mapToOnecoreLease,
  mapToOnecoreRentalObjectRent,
} from '../../helpers/tenfast'
import { toYearMonthDayString } from '../../adapters/tenfast/schemas'
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

  it('returns PreliminaryTerminated while a notice awaits signing', () => {
    const lease = factory.tenfastLease.build({
      stage: 'terminationSigningInProgress',
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

describe('lease end date (via mapToOnecoreLease)', () => {
  const preliminaryEndDate = new Date('2027-02-28T00:00:00.000Z')
  const simplesignTermination = { signatures: [], preliminaryEndDate }

  it('uses the preliminary end date while a notice awaits signing', () => {
    const lease = mapToOnecoreLease(
      factory.tenfastLease.build({
        stage: 'terminationSigningInProgress',
        endDate: null,
        simplesignTermination,
      })
    )

    expect(lease.leaseEndDate).toEqual(preliminaryEndDate)
    expect(lease.lastDebitDate).toEqual(preliminaryEndDate)
  })

  it('keeps an end date already set on the lease', () => {
    const endDate = new Date('2027-01-31T00:00:00.000Z')
    const lease = mapToOnecoreLease(
      factory.tenfastLease.build({
        stage: 'terminationSigningInProgress',
        endDate,
        simplesignTermination,
      })
    )

    expect(lease.leaseEndDate).toEqual(endDate)
  })

  it('ignores the preliminary end date in other stages', () => {
    const lease = mapToOnecoreLease(
      factory.tenfastLease.build({
        stage: 'active',
        endDate: null,
        simplesignTermination,
      })
    )

    expect(lease.leaseEndDate).toBeUndefined()
    expect(lease.lastDebitDate).toBeUndefined()
  })
})

describe('mapTenfastTypToLeaseType (via mapToOnecoreLease)', () => {
  it.each([
    ['bostad', LeaseType.HousingContract],
    ['parkering', LeaseType.ParkingSpaceContract],
    ['lokal', LeaseType.CommercialTenantContract],
    ['garage', LeaseType.GarageContract],
    ['förråd', LeaseType.CommercialTenantContract],
    ['Förråd', LeaseType.CommercialTenantContract],
    ['forrad', LeaseType.CommercialTenantContract],
    ['ovrigt', LeaseType.OtherContract],
    ['unknown', LeaseType.OtherContract],
  ])('maps "%s" to %s', (typ, expected) => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [factory.tenfastRentalObject.build({ typ })],
    })

    expect(mapToOnecoreLease(lease).type).toBe(expected)
  })

  it('handles uppercase casing', () => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [factory.tenfastRentalObject.build({ typ: 'Bostad' })],
    })

    expect(mapToOnecoreLease(lease).type).toBe(LeaseType.HousingContract)
  })

  it('falls back to OtherContract for unknown typ', () => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [factory.tenfastRentalObject.build({ typ: 'unknown' })],
    })

    expect(mapToOnecoreLease(lease).type).toBe(LeaseType.OtherContract)
  })

  it('falls back to OtherContract when typ is undefined', () => {
    const lease = factory.tenfastLease.build({
      hyresobjekt: [factory.tenfastRentalObject.build({ typ: undefined })],
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

describe('buildTenfastLeaseUrl', () => {
  const originalAppUrl = config.tenfast.appUrl

  afterEach(() => {
    config.tenfast.appUrl = originalAppUrl
  })

  it('builds a link to the lease in the Tenfast UI', () => {
    config.tenfast.appUrl = 'https://tenfast.example.com'

    expect(buildTenfastLeaseUrl('6ae9b2cd672cf891f4543fde')).toBe(
      'https://tenfast.example.com/hyresvard/avtal/6ae9b2cd672cf891f4543fde'
    )
  })

  it('ignores a trailing slash in the configured URL', () => {
    config.tenfast.appUrl = 'https://tenfast.example.com/'

    expect(buildTenfastLeaseUrl('abc')).toBe(
      'https://tenfast.example.com/hyresvard/avtal/abc'
    )
  })

  it('encodes the id', () => {
    config.tenfast.appUrl = 'https://tenfast.example.com'

    expect(buildTenfastLeaseUrl('a/b')).toBe(
      'https://tenfast.example.com/hyresvard/avtal/a%2Fb'
    )
  })

  it('keeps a path in the configured URL', () => {
    config.tenfast.appUrl = 'https://example.com/tenfast'

    expect(buildTenfastLeaseUrl('abc')).toBe(
      'https://example.com/tenfast/hyresvard/avtal/abc'
    )
  })

  it('returns undefined and warns once when the configured URL is invalid', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    config.tenfast.appUrl = 'tenfast-invalid.example.com'

    expect(buildTenfastLeaseUrl('abc')).toBeUndefined()
    expect(buildTenfastLeaseUrl('def')).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  it('does not fail the lease mapping when the configured URL is invalid', () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    config.tenfast.appUrl = 'not a url'
    const lease = factory.tenfastLease.build()

    const mapped = mapToOnecoreLease(lease)

    expect(mapped.leaseId).toBe(lease.externalId)
    expect(mapped.externalUrl).toBeUndefined()

    jest.restoreAllMocks()
  })

  it('returns undefined when no Tenfast UI URL is configured', () => {
    config.tenfast.appUrl = ''

    expect(buildTenfastLeaseUrl('abc')).toBeUndefined()
  })

  it('is used by mapToOnecoreLease with the Tenfast _id', () => {
    config.tenfast.appUrl = 'https://tenfast.example.com'
    const lease = factory.tenfastLease.build({ _id: 'mongo-id-1' })

    expect(mapToOnecoreLease(lease).externalUrl).toBe(
      'https://tenfast.example.com/hyresvard/avtal/mongo-id-1'
    )
  })
})

describe('mapToOnecoreRentalObjectRent', () => {
  it('maps amounts, vat and rows from the Tenfast rental object', () => {
    const rentalObject = factory.tenfastRentalObject.build({
      hyraExcludingVat: 1000,
      hyraVat: 250,
      hyror: [
        factory.tenfastInvoiceRow.build({
          amount: 1000,
          vat: 0.25,
          article: 'article-1',
          label: 'Hyra bostad',
          from: toYearMonthDayString(new Date('2026-01-01')),
          to: toYearMonthDayString(new Date('2026-12-31')),
        }),
      ],
    })

    expect(mapToOnecoreRentalObjectRent(rentalObject)).toEqual({
      amount: 1000,
      vat: 250,
      rows: [
        {
          code: 'article-1',
          description: 'Hyra bostad',
          amount: 1000,
          vatPercentage: 0.25,
          fromDate: new Date('2026-01-01'),
          toDate: new Date('2026-12-31'),
        },
      ],
    })
  })

  it('falls back to empty strings and undefined dates for missing row fields', () => {
    const rentalObject = factory.tenfastRentalObject.build({
      hyror: [
        factory.tenfastInvoiceRow.build({
          amount: 115,
          vat: 0,
          article: null,
          label: null,
          from: null,
          to: null,
        }),
      ],
    })

    expect(mapToOnecoreRentalObjectRent(rentalObject).rows).toEqual([
      {
        code: '',
        description: '',
        amount: 115,
        vatPercentage: 0,
        fromDate: undefined,
        toDate: undefined,
      },
    ])
  })

  it('handles missing rent totals and rows', () => {
    const rentalObject = factory.tenfastRentalObject.build({
      hyraExcludingVat: undefined,
      hyraVat: undefined,
      hyror: undefined,
    })

    expect(mapToOnecoreRentalObjectRent(rentalObject)).toEqual({
      amount: 0,
      vat: 0,
      rows: [],
    })
  })
})
