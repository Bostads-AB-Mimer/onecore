import {
  hasIndefiniteActiveBlock,
  determineVacantFrom,
  withRentAt,
} from '../../helpers/rental-object-availability-helpers'
import { RentalObjectFactory } from '../factories/rental-object'
import { RentalObjectAvailabilityInfoFactory } from '../factories/rental-object-availability-info'

describe('rental-object-availability-helpers', () => {
  const TODAY = new Date('2026-03-31T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(TODAY)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('hasIndefiniteActiveBlock', () => {
    it('returns false when there is no blockStartDate', () => {
      const ps = RentalObjectFactory.build()
      expect(hasIndefiniteActiveBlock(ps)).toBe(false)
    })

    it('returns false when block has an end date, even while currently active', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-03-01'),
        blockEndDate: new Date('2026-04-30'),
      })
      expect(hasIndefiniteActiveBlock(ps)).toBe(false)
    })

    it('returns true when an indefinite block started today', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-03-31'),
      })
      expect(hasIndefiniteActiveBlock(ps)).toBe(true)
    })

    it('returns true when an indefinite block started in the past', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-03-01'),
      })
      expect(hasIndefiniteActiveBlock(ps)).toBe(true)
    })

    it('returns false when an indefinite block starts in the future', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-04-01'),
      })
      expect(hasIndefiniteActiveBlock(ps)).toBe(false)
    })
  })

  describe('determineVacantFrom', () => {
    it('returns the day after blockEndDate when it is in the future', () => {
      const result = determineVacantFrom(TODAY, '2026-03-01', '2026-04-15')
      expect(result).toEqual(new Date('2026-04-16T00:00:00.000Z'))
    })

    it('returns the day after blockEndDate when it is today', () => {
      const result = determineVacantFrom(TODAY, '2026-03-01', '2026-03-31')
      expect(result).toEqual(new Date('2026-04-01T00:00:00.000Z'))
    })

    it('returns undefined when blockStartDate exists but blockEndDate does not', () => {
      const result = determineVacantFrom(TODAY, '2026-03-01', null)
      expect(result).toBeUndefined()
    })

    it('returns vacantFromDate as-is when there is no block', () => {
      const result = determineVacantFrom(
        new Date('2026-03-15T00:00:00.000Z'),
        null,
        null
      )
      expect(result).toEqual(new Date('2026-03-15T00:00:00.000Z'))
    })

    it('returns undefined without a vacantFromDate: leased until further notice', () => {
      expect(determineVacantFrom(undefined, null, null)).toBeUndefined()
      expect(determineVacantFrom(null, null, null)).toBeUndefined()
    })

    it('returns undefined without a vacantFromDate whatever the block says', () => {
      expect(
        determineVacantFrom(undefined, '2026-03-01', '2026-04-15')
      ).toBeUndefined()
      expect(
        determineVacantFrom(undefined, '2026-03-01', '2026-03-20')
      ).toBeUndefined()
    })

    it('returns vacantFromDate as-is when blockEndDate is in the past', () => {
      const result = determineVacantFrom(
        new Date('2026-03-15T00:00:00.000Z'),
        '2026-03-01',
        '2026-03-20'
      )
      expect(result).toEqual(new Date('2026-03-15T00:00:00.000Z'))
    })

    it('returns vacantFromDate (today) when blockEndDate is in the past', () => {
      const result = determineVacantFrom(TODAY, '2026-03-01', '2026-03-20')
      expect(result).toEqual(new Date('2026-03-31T00:00:00.000Z'))
    })

    it('returns vacantFromDate when it is later than the day after blockEndDate', () => {
      // Block ends April 30, lease ends July 31 (vacantFromDate = Aug 1)
      // The space is still leased past the block, so Aug 1 should win
      const result = determineVacantFrom(
        new Date('2026-08-01T00:00:00.000Z'),
        '2026-03-01',
        '2026-04-30'
      )
      expect(result).toEqual(new Date('2026-08-01T00:00:00.000Z'))
    })

    it('returns day after blockEndDate when it is later than vacantFromDate', () => {
      // Block ends October 31, lease ended July 31 (vacantFromDate = Aug 1)
      // Block extends past the lease, so Nov 1 should win
      const result = determineVacantFrom(
        new Date('2026-08-01T00:00:00.000Z'),
        '2026-03-01',
        '2026-10-31'
      )
      expect(result).toEqual(new Date('2026-11-01T00:00:00.000Z'))
    })
  })

  describe('withRentAt', () => {
    // The rent rows of the rental object in AVTAL-489, with the rent raised
    // from the turn of the year. Tenfast's total (amount) is for today.
    const availabilityInfo = RentalObjectAvailabilityInfoFactory.build({
      rent: {
        amount: 7791.28,
        vat: 0,
        rows: [
          {
            description: 'Home insurance',
            amount: 93,
            vatPercentage: 0,
            fromDate: new Date('2026-01-01'),
            includedInRent: false,
          },
          {
            description: 'Rent',
            amount: 7775.88,
            vatPercentage: 0,
            fromDate: new Date('2026-01-01'),
            toDate: new Date('2026-12-31'),
            includedInRent: true,
          },
          {
            description: 'Rent',
            amount: 10032,
            vatPercentage: 0,
            fromDate: new Date('2027-01-01'),
            includedInRent: true,
          },
          {
            description: 'Operating cost',
            amount: 0.4,
            vatPercentage: 0,
            fromDate: new Date('2026-01-01'),
            includedInRent: true,
          },
          {
            description: 'Rent setting fee',
            amount: 15,
            vatPercentage: 0,
            fromDate: new Date('2025-01-01'),
            includedInRent: true,
          },
        ],
      },
    })

    it('sums the rows in force on a later day', () => {
      const result = withRentAt(availabilityInfo, new Date('2027-01-16'))

      expect(result.rent.amount).toBe(10047.4)
      expect(result.rent.vat).toBe(0)
    })

    it('counts a row on its first and on its last day', () => {
      expect(
        withRentAt(availabilityInfo, new Date('2026-12-31')).rent.amount
      ).toBe(7791.28)
      expect(
        withRentAt(availabilityInfo, new Date('2027-01-01')).rent.amount
      ).toBe(10047.4)
    })

    it('leaves out rows that are not part of the rent', () => {
      const result = withRentAt(
        {
          ...availabilityInfo,
          rent: {
            ...availabilityInfo.rent,
            rows: availabilityInfo.rent.rows.map((row) => ({
              ...row,
              includedInRent: row.description !== 'Rent setting fee',
            })),
          },
        },
        new Date('2027-01-16')
      )

      // Home insurance (93) now counts, the fee (15) does not.
      expect(result.rent.amount).toBe(10125.4)
    })

    it('counts a row that does not say whether it is part of the rent', () => {
      const result = withRentAt(
        {
          ...availabilityInfo,
          rent: {
            ...availabilityInfo.rent,
            rows: [{ description: 'Rent', amount: 500, vatPercentage: 0 }],
          },
        },
        new Date('2027-01-16')
      )

      expect(result.rent.amount).toBe(500)
    })

    it('keeps the rows and everything else as they are', () => {
      const result = withRentAt(availabilityInfo, new Date('2027-01-16'))

      expect(result).toEqual({
        ...availabilityInfo,
        rent: { ...availabilityInfo.rent, amount: 10047.4 },
      })
    })

    it.each([
      ['no day', undefined],
      ['today', TODAY],
      ['a day that has passed', new Date('2026-01-16')],
    ])('keeps the total from Tenfast for %s', (_, rentAt) => {
      expect(withRentAt(availabilityInfo, rentAt)).toBe(availabilityInfo)
    })

    it.each([
      [
        'every row has ended by then',
        [
          {
            description: 'Rent',
            amount: 7775.88,
            vatPercentage: 0,
            toDate: new Date('2026-12-31'),
            includedInRent: true,
          },
        ],
      ],
      [
        'only rows outside the rent are in force then',
        [
          {
            description: 'Home insurance',
            amount: 93,
            vatPercentage: 0,
            includedInRent: false,
          },
        ],
      ],
      ['there are no rows', []],
    ])('keeps the total from Tenfast when %s', (_, rows) => {
      const withoutRowsInForce = {
        ...availabilityInfo,
        rent: { ...availabilityInfo.rent, rows },
      }

      expect(withRentAt(withoutRowsInForce, new Date('2027-01-16'))).toBe(
        withoutRowsInForce
      )
    })

    it('gives the VAT part of rows that include VAT', () => {
      const result = withRentAt(
        {
          ...availabilityInfo,
          rent: {
            amount: 500,
            vat: 100,
            rows: [
              {
                description: 'Parking',
                amount: 500,
                vatPercentage: 0.25,
                toDate: new Date('2026-12-31'),
              },
              {
                description: 'Parking',
                amount: 625,
                vatPercentage: 0.25,
                fromDate: new Date('2027-01-01'),
              },
            ],
          },
        },
        new Date('2027-01-16')
      )

      expect(result.rent.amount).toBe(625)
      expect(result.rent.vat).toBe(125)
    })
  })
})
