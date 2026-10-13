import {
  getCurrentTenancyEndDate,
  getLatestStartedLease,
  getLatestTenancyCutoff,
  mapTenfastRentalObjectToAvailabilityInfo,
} from '../../../adapters/tenfast/tenfast-rental-object-helpers'
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

  const noNotice = () => ({
    ...factory.tenfastLease.build().cancellation,
    requested: false,
    cancelled: false,
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
        cancellation: noNotice(),
      })
      expect(getLatestTenancyCutoff([older, fixedTerm])).toEqual(
        new Date('2025-08-15')
      )
    })
  })

  describe('getCurrentTenancyEndDate', () => {
    it('is null without a started lease or without an end date', () => {
      const openEnded = factory.tenfastLease.build({
        startDate: new Date('2026-01-01'),
        endDate: null,
      })
      expect(getCurrentTenancyEndDate([])).toBeNull()
      expect(getCurrentTenancyEndDate([openEnded])).toBeNull()
    })

    it('uses the end date of a fixed-term lease that has no notice', () => {
      const fixedTerm = factory.tenfastLease.build({
        startDate: new Date('2025-08-15'),
        endDate: new Date('2026-06-30'),
        stage: 'active',
        cancellation: noNotice(),
      })
      expect(getCurrentTenancyEndDate([fixedTerm])).toEqual(
        new Date('2026-06-30')
      )
    })

    it('uses the end date set by a notice', () => {
      const givenNotice = factory.tenfastLease.build({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-06-30'),
        stage: 'terminationScheduled',
      })
      expect(getCurrentTenancyEndDate([givenNotice])).toEqual(
        new Date('2026-06-30')
      )
    })

    it('reads the current tenancy, not an upcoming one', () => {
      const current = factory.tenfastLease.build({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-06-30'),
        stage: 'terminationScheduled',
      })
      const upcoming = factory.tenfastLease.build({
        startDate: new Date('2026-07-01'),
        endDate: null,
        stage: 'upcoming',
      })
      expect(getCurrentTenancyEndDate([current, upcoming])).toEqual(
        new Date('2026-06-30')
      )
    })
  })

  describe('mapTenfastRentalObjectToAvailabilityInfo', () => {
    it('sets vacantFrom to today when there are no active leases', () => {
      const rentalObject = factory.tenfastRentalObject.build({ avtal: [] })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject
      )
      expect(result.vacantFrom).toEqual(TODAY)
    })

    it('sets vacantFrom to today when the last tenancy already ended', () => {
      const ended = factory.tenfastLease.build({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2026-02-28'),
        stage: 'archived',
      })
      const rentalObject = factory.tenfastRentalObject.build({ avtal: [ended] })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject
      )
      expect(result.vacantFrom).toEqual(TODAY)
      expect(result.listingHistorySince).toEqual(new Date('2025-01-01'))
    })

    it('sets vacantFrom to the day after the current tenancy ends', () => {
      const lease = factory.tenfastLease.build({
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        cancellation: {
          cancelled: false,
          requested: true,
          doneAutomatically: false,
          receivedCancellationAt: null,
          notifiedAt: null,
          handledAt: null,
          handledBy: null,
          preferredMoveOutDate: null,
          cancelledByType: null,
        },
      })
      const rentalObject = factory.tenfastRentalObject.build({ avtal: [lease] })
      const result = mapTenfastRentalObjectToAvailabilityInfo(
        false,
        rentalObject
      )
      expect(result.vacantFrom).toEqual(new Date('2026-07-01T00:00:00.000Z'))
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
