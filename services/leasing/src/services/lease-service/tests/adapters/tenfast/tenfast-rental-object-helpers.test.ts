import {
  getLatestActiveLeasesEndDate,
  mapTenfastRentalObjectToAvailabilityInfo,
  parseCategoryToRentalTag,
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

  describe('getLatestActiveLeasesEndDate', () => {
    it('returns null for an empty lease array', () => {
      expect(getLatestActiveLeasesEndDate([])).toBeNull()
    })

    it('returns null when there are no active leases', () => {
      const endedLease = factory.tenfastLease.build({
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-01'), // ended before today
        stage: 'archived',
      })
      expect(getLatestActiveLeasesEndDate([endedLease])).toBeNull()
    })

    it('returns null when active leases have no end date', () => {
      const currentLease = factory.tenfastLease.build({
        startDate: new Date('2026-01-01'),
        endDate: null, // no end date → endDate filtered out
      })
      expect(getLatestActiveLeasesEndDate([currentLease])).toBeNull()
    })

    it('returns the end date of a single active lease', () => {
      const currentLease = factory.tenfastLease.build({
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
      })
      expect(getLatestActiveLeasesEndDate([currentLease])).toEqual(
        new Date('2026-06-30')
      )
    })

    it('returns the latest end date when there are multiple active leases', () => {
      const leases = [
        factory.tenfastLease.build({
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-06-30'),
        }),
        factory.tenfastLease.build({
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        }),
        factory.tenfastLease.build({
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-09-15'),
        }),
      ]
      expect(getLatestActiveLeasesEndDate(leases)).toEqual(
        new Date('2026-12-31')
      )
    })

    it('ignores ended leases when determining the latest end date', () => {
      const leases = [
        factory.tenfastLease.build({
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'), // ended
          stage: 'archived',
        }),
        factory.tenfastLease.build({
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-06-30'), // current
        }),
      ]
      expect(getLatestActiveLeasesEndDate(leases)).toEqual(
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

    it('sets vacantFrom to the day after the latest active lease end date', () => {
      const lease = factory.tenfastLease.build({
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
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

  describe('parseCategoryToRentalTag', () => {
    it('returns id and name as the same value for a single-word category', () => {
      expect(parseCategoryToRentalTag('Bilplats')).toEqual({
        id: 'Bilplats',
        name: 'Bilplats',
      })
    })

    it('splits a space-separated category into id and name', () => {
      expect(parseCategoryToRentalTag('BP Bilplats')).toEqual({
        id: 'BP',
        name: 'Bilplats',
      })
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
        ['tag-1', 'Ungdomslägenhet'],
        ['tag-2', 'Rökfritt'],
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
        { id: 'tag-1', name: 'Ungdomslägenhet' },
        { id: 'tag-2', name: 'Rökfritt' },
      ])
    })

    it('filters out tag ids not present in tagsById', () => {
      const tagsById = new Map([['tag-1', 'Ungdomslägenhet']])
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
        { id: 'tag-1', name: 'Ungdomslägenhet' },
      ])
    })

    it('returns empty array when no tag ids match tagsById', () => {
      const tagsById = new Map([['tag-1', 'Ungdomslägenhet']])
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
        category: 'Bilplats',
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
