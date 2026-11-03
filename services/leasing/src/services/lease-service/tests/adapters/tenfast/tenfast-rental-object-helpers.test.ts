import {
  getLatestStartedLease,
  getLatestTenancyCutoff,
  getLeasedUntil,
  mapTenfastRentalObjectToAvailabilityInfo,
} from '../../../adapters/tenfast/tenfast-rental-object-helpers'
import { TenfastLease } from '../../../adapters/tenfast/schemas'
import * as factory from '../../factories'

describe('tenfast-rental-object-helpers', () => {
  const TODAY = new Date('2026-03-31T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(TODAY)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const notice = (requested: boolean, withdrawn = false) => ({
    cancelled: withdrawn,
    requested,
    doneAutomatically: false,
    receivedCancellationAt: null,
    notifiedAt: null,
    handledAt: null,
    handledBy: null,
    preferredMoveOutDate: null,
    cancelledByType: null,
  })
  // Leases as Tenfast has them: endDate is set when notice is given.
  const untilFurtherNotice = (stage = 'active') =>
    factory.tenfastLease.build({
      stage,
      startDate: new Date('2025-01-01'),
      endDate: null,
      cancellation: notice(false),
    })
  const terminated = (endDate: string, stage = 'terminationScheduled') =>
    factory.tenfastLease.build({
      stage,
      startDate: new Date('2025-01-01'),
      endDate: new Date(endDate),
      cancellation: notice(true),
    })

  describe('getLatestStartedLease', () => {
    it('ignores leases that have not begun', () => {
      const upcoming = factory.tenfastLease.build({
        startDate: new Date('2026-05-01'),
        stage: 'upcoming',
      })
      expect(getLatestStartedLease([])).toBeNull()
      expect(getLatestStartedLease([upcoming])).toBeNull()
    })

    it('skips drafts, unsigned and voided leases even with a past start', () => {
      const tenancy = factory.tenfastLease.build({
        startDate: new Date('2025-01-01'),
        stage: 'active',
      })
      const noise = ['draft', 'signingInProgress', 'voided', 'rejected'].map(
        (stage) =>
          factory.tenfastLease.build({
            startDate: new Date('2026-03-01'),
            stage,
          })
      )
      expect(getLatestStartedLease([...noise, tenancy])).toBe(tenancy)
      expect(getLatestStartedLease(noise)).toBeNull()
    })

    it('picks the most recently started real lease regardless of stage', () => {
      const older = factory.tenfastLease.build({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-06-30'),
        stage: 'archived',
      })
      const current = factory.tenfastLease.build({
        startDate: new Date('2025-07-01'),
        endDate: null,
        stage: 'active',
      })
      const upcoming = factory.tenfastLease.build({
        startDate: new Date('2026-08-01'),
        stage: 'upcoming',
      })
      expect(getLatestStartedLease([upcoming, older, current])).toBe(current)
    })
  })

  describe('getLatestTenancyCutoff', () => {
    it('is null when no lease has started', () => {
      expect(getLatestTenancyCutoff([])).toBeNull()
    })

    it('is the start of the latest started lease, whatever its stage', () => {
      const older = factory.tenfastLease.build({
        startDate: new Date('2024-01-01'),
        stage: 'archived',
      })
      const fixedTerm = factory.tenfastLease.build({
        startDate: new Date('2025-08-15'),
        endDate: new Date('2026-06-30'),
        stage: 'active',
        cancellation: notice(false),
      })
      expect(getLatestTenancyCutoff([older, fixedTerm])).toEqual(
        new Date('2025-08-15')
      )
    })
  })

  describe('getLeasedUntil', () => {
    it('is null without leases', () => {
      expect(getLeasedUntil([])).toBeNull()
    })

    it('is null when no lease is running or to come', () => {
      expect(getLeasedUntil([terminated('2026-03-01', 'archived')])).toBeNull()
    })

    it('is the end date of a terminated lease without a successor', () => {
      expect(getLeasedUntil([terminated('2026-06-30')])).toEqual(
        new Date('2026-06-30')
      )
    })

    it('is indefinite for a lease until further notice', () => {
      expect(getLeasedUntil([untilFurtherNotice()])).toBe('indefinite')
    })

    it('is indefinite for a terminated lease with a signed successor', () => {
      // 922-705-00-0003 on Tenfast test: ends 2026-10-31, successor from 2026-11-01
      expect(
        getLeasedUntil([
          terminated('2026-10-31'),
          untilFurtherNotice('upcoming'),
        ])
      ).toBe('indefinite')
    })

    it('is the end date of a fixed-term lease without notice', () => {
      const fixedTerm = factory.tenfastLease.build({
        endDate: new Date('2026-08-31'),
        cancellation: notice(false),
      })
      expect(getLeasedUntil([fixedTerm])).toEqual(new Date('2026-08-31'))
    })

    it('is the latest end when every lease in force has one', () => {
      expect(
        getLeasedUntil([
          terminated('2026-10-31'),
          terminated('2026-12-31', 'upcoming'),
        ])
      ).toEqual(new Date('2026-12-31'))
    })

    it('is indefinite when a notice was withdrawn, even if an end date is left', () => {
      const withdrawn = factory.tenfastLease.build({
        endDate: new Date('2026-06-30'),
        cancellation: notice(true, true),
      })
      expect(getLeasedUntil([withdrawn])).toBe('indefinite')
    })

    it('ignores ended leases', () => {
      expect(
        getLeasedUntil([
          untilFurtherNotice('archived'),
          terminated('2026-06-30'),
        ])
      ).toEqual(new Date('2026-06-30'))
    })

    it('counts a termination awaiting signature as in force', () => {
      expect(
        getLeasedUntil([terminated('2026-06-30', 'preTermination')])
      ).toEqual(new Date('2026-06-30'))
      expect(getLeasedUntil([untilFurtherNotice('preTermination')])).toBe(
        'indefinite'
      )
    })

    it('ignores leases that never held the object', () => {
      for (const stage of [
        'voided',
        'rejected',
        'draft',
        'signingInProgress',
      ]) {
        expect(getLeasedUntil([untilFurtherNotice(stage)])).toBeNull()
      }
    })

    it('is indefinite for a lease with a missing or unknown stage', () => {
      // Better not vacant than vacant on a lease we can't read.
      const { stage: _, ...noStage } = terminated('2026-06-30')
      expect(getLeasedUntil([noStage as TenfastLease])).toBe('indefinite')
      expect(getLeasedUntil([terminated('2026-06-30', 'somethingNew')])).toBe(
        'indefinite'
      )
    })

    it('copes with a lease without cancellation', () => {
      // Leases on a rental object are parsed partially, so this can happen.
      const { cancellation: _, ...lease } = terminated('2026-06-30')
      expect(getLeasedUntil([lease as TenfastLease])).toEqual(
        new Date('2026-06-30')
      )
    })
  })

  describe('mapTenfastRentalObjectToAvailabilityInfo', () => {
    const vacantFrom = (avtal: ReturnType<typeof terminated>[]) =>
      mapTenfastRentalObjectToAvailabilityInfo(
        false,
        factory.tenfastRentalObject.build({ avtal })
      ).vacantFrom

    it('is vacant today without leases', () => {
      expect(vacantFrom([])).toEqual(TODAY)
    })

    it('sets listingHistorySince to the start of the latest started lease', () => {
      const ended = factory.tenfastLease.build({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-02-28'),
        stage: 'archived',
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        factory.tenfastRentalObject.build({ avtal: [ended] })
      )
      expect(result.vacantFrom).toEqual(TODAY)
      expect(result.listingHistorySince).toEqual(new Date('2025-01-01'))
    })

    it('is vacant the day after the last lease ends', () => {
      expect(vacantFrom([terminated('2026-06-30')])).toEqual(
        new Date('2026-07-01T00:00:00.000Z')
      )
    })

    it('is not vacant while leased until further notice', () => {
      expect(vacantFrom([untilFurtherNotice()])).toBeUndefined()
    })

    it('is not vacant when a signed successor takes over', () => {
      expect(
        vacantFrom([terminated('2026-10-31'), untilFurtherNotice('upcoming')])
      ).toBeUndefined()
    })

    it('maps rentalObjectCode from externalId', () => {
      const rentalObject = factory.tenfastRentalObject.build({
        externalId: 'R1234',
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject
      )
      expect(result.rentalObjectCode).toBe('R1234')
    })

    it('returns rent amount excluding VAT when includeVAT is false', () => {
      const rentalObject = factory.tenfastRentalObject.build({
        hyra: 1250,
        hyraExcludingVat: 1000,
        hyraVat: 250,
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject
      )
      expect(result.rent.amount).toBe(1000)
      expect(result.rent.vat).toBe(0)
    })

    it('returns rent amount including VAT when includeVAT is true', () => {
      const rentalObject = factory.tenfastRentalObject.build({
        hyra: 1250,
        hyraExcludingVat: 1000,
        hyraVat: 250,
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        true,
        rentalObject
      )
      expect(result.rent.amount).toBe(1250)
      expect(result.rent.vat).toBe(250)
    })
  })

  describe('rentalTags in mapTenfastRentalObjectToAvailabilityInfo', () => {
    it('returns undefined rentalTags when rental object has no tags field', () => {
      const rentalObject = factory.tenfastRentalObject.build({
        tags: undefined,
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject
      )
      expect(result.rentalTags).toBeUndefined()
    })

    it('returns empty array when rental object has empty tags', () => {
      const rentalObject = factory.tenfastRentalObject.build({
        tags: [],
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject
      )
      expect(result.rentalTags).toEqual([])
    })

    it('maps tag ids to name objects using tagsById', () => {
      const tagsById = new Map([
        ['tag-1', { _id: 'tag-1', code: 'UNGDOM', name: 'Ungdomslägenhet' }],
        ['tag-2', { _id: 'tag-2', code: 'ROKFRITT', name: 'Rökfritt' }],
      ])
      const rentalObject = factory.tenfastRentalObject.build({
        tags: ['tag-1', 'tag-2'],
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject,
        tagsById
      )
      expect(result.rentalTags).toEqual([
        { id: 'UNGDOM', name: 'Ungdomslägenhet' },
        { id: 'ROKFRITT', name: 'Rökfritt' },
      ])
    })

    it('filters out tag ids not present in tagsById', () => {
      const tagsById = new Map([
        ['tag-1', { _id: 'tag-1', code: 'UNGDOM', name: 'Ungdomslägenhet' }],
      ])
      const rentalObject = factory.tenfastRentalObject.build({
        tags: ['tag-1', 'tag-unknown'],
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject,
        tagsById
      )
      expect(result.rentalTags).toEqual([
        { id: 'UNGDOM', name: 'Ungdomslägenhet' },
      ])
    })

    it('returns empty array when no tag ids match tagsById', () => {
      const tagsById = new Map([
        ['tag-1', { _id: 'tag-1', code: 'UNGDOM', name: 'Ungdomslägenhet' }],
      ])
      const rentalObject = factory.tenfastRentalObject.build({
        tags: ['tag-unknown'],
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject,
        tagsById
      )
      expect(result.rentalTags).toEqual([])
    })

    it('returns empty array when tagsById is empty', () => {
      const rentalObject = factory.tenfastRentalObject.build({
        tags: ['tag-1', 'tag-2'],
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject,
        new Map()
      )
      expect(result.rentalTags).toEqual([])
    })

    it('maps rentalTenureType from category', () => {
      const rentalObject = factory.tenfastRentalObject.build({
        category: { code: 'Bilplats', label: 'Bilplats' },
        avtal: [],
      })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject
      )
      expect(result.rentalTenureType).toEqual({
        id: 'Bilplats',
        name: 'Bilplats',
      })
    })
  })
})
