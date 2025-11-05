import { calculateRentInfo, calculateMonthlyRent } from '../../helpers/rent-calculation'
import { logger } from '@onecore/utilities'

// Mock the logger
jest.mock('@onecore/utilities', () => ({
  logger: {
    warn: jest.fn(),
  },
}))

describe('rent-calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateRentInfo', () => {
    it('should return undefined when yearrentrows is null', () => {
      const result = calculateRentInfo(null)
      expect(result).toBeUndefined()
    })

    it('should return undefined when yearrentrows is undefined', () => {
      const result = calculateRentInfo(undefined)
      expect(result).toBeUndefined()
    })

    it('should return undefined when yearrentrows is empty string', () => {
      const result = calculateRentInfo('')
      expect(result).toBeUndefined()
    })

    it('should return undefined and log warning when JSON parse fails', () => {
      const result = calculateRentInfo('invalid json')
      expect(result).toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to parse yearrentrows'
      )
    })

    it('should return undefined when yearRentRows is empty array', () => {
      const result = calculateRentInfo('[]')
      expect(result).toBeUndefined()
    })

    it('should correctly calculate monthly rent from single yearrent value', () => {
      const yearrentrows = JSON.stringify([{ yearrent: 120000 }])
      const result = calculateRentInfo(yearrentrows)

      expect(result).toBeDefined()
      expect(result?.currentRent.currentRent).toBe(10000) // 120000 / 12
      expect(result?.currentRent.vat).toBe(0)
      expect(result?.futureRents).toBeUndefined()
    })

    it('should correctly sum multiple yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 100000 },
        { yearrent: 20000 },
        { yearrent: 4000 },
      ])
      const result = calculateRentInfo(yearrentrows)

      expect(result).toBeDefined()
      expect(result?.currentRent.currentRent).toBe(10333.333333333334) // 124000 / 12
    })

    it('should handle string yearrent values by treating them as 0', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: 'invalid' },
      ])
      const result = calculateRentInfo(yearrentrows)

      expect(result).toBeDefined()
      expect(result?.currentRent.currentRent).toBe(10000) // 120000 / 12
    })

    it('should handle null yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: null },
      ])
      const result = calculateRentInfo(yearrentrows)

      expect(result).toBeDefined()
      expect(result?.currentRent.currentRent).toBe(10000) // 120000 / 12
    })

    it('should handle undefined yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: undefined },
      ])
      const result = calculateRentInfo(yearrentrows)

      expect(result).toBeDefined()
      expect(result?.currentRent.currentRent).toBe(10000) // 120000 / 12
    })

    it('should handle NaN yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: NaN },
      ])
      const result = calculateRentInfo(yearrentrows)

      expect(result).toBeDefined()
      expect(result?.currentRent.currentRent).toBe(10000) // 120000 / 12
    })

    it('should return undefined when all yearrent values are 0 or invalid', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 0 },
        { yearrent: null },
        { yearrent: 'invalid' },
      ])
      const result = calculateRentInfo(yearrentrows)

      expect(result).toBeUndefined()
    })

    it('should set all optional rent fields to undefined', () => {
      const yearrentrows = JSON.stringify([{ yearrent: 120000 }])
      const result = calculateRentInfo(yearrentrows)

      expect(result?.currentRent.additionalChargeDescription).toBeUndefined()
      expect(result?.currentRent.additionalChargeAmount).toBeUndefined()
      expect(result?.currentRent.rentStartDate).toBeUndefined()
      expect(result?.currentRent.rentEndDate).toBeUndefined()
    })
  })

  describe('calculateMonthlyRent', () => {
    it('should return 0 when yearrentrows is null', () => {
      const result = calculateMonthlyRent(null)
      expect(result).toBe(0)
    })

    it('should return 0 when yearrentrows is undefined', () => {
      const result = calculateMonthlyRent(undefined)
      expect(result).toBe(0)
    })

    it('should return 0 when yearrentrows is empty string', () => {
      const result = calculateMonthlyRent('')
      expect(result).toBe(0)
    })

    it('should return 0 and log warning when JSON parse fails', () => {
      const result = calculateMonthlyRent('invalid json')
      expect(result).toBe(0)
      expect(logger.warn).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to parse yearrentrows'
      )
    })

    it('should return 0 when yearRentRows is empty array', () => {
      const result = calculateMonthlyRent('[]')
      expect(result).toBe(0)
    })

    it('should correctly calculate monthly rent from single yearrent value', () => {
      const yearrentrows = JSON.stringify([{ yearrent: 120000 }])
      const result = calculateMonthlyRent(yearrentrows)

      expect(result).toBe(10000) // 120000 / 12
    })

    it('should correctly sum multiple yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 100000 },
        { yearrent: 20000 },
        { yearrent: 4000 },
      ])
      const result = calculateMonthlyRent(yearrentrows)

      expect(result).toBe(10333.333333333334) // 124000 / 12
    })

    it('should handle string yearrent values by treating them as 0', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: 'invalid' },
      ])
      const result = calculateMonthlyRent(yearrentrows)

      expect(result).toBe(10000) // 120000 / 12
    })

    it('should handle null yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: null },
      ])
      const result = calculateMonthlyRent(yearrentrows)

      expect(result).toBe(10000) // 120000 / 12
    })

    it('should handle undefined yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: undefined },
      ])
      const result = calculateMonthlyRent(yearrentrows)

      expect(result).toBe(10000) // 120000 / 12
    })

    it('should handle NaN yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: NaN },
      ])
      const result = calculateMonthlyRent(yearrentrows)

      expect(result).toBe(10000) // 120000 / 12
    })

    it('should return 0 when all yearrent values are 0 or invalid', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 0 },
        { yearrent: null },
        { yearrent: 'invalid' },
      ])
      const result = calculateMonthlyRent(yearrentrows)

      expect(result).toBe(0)
    })

    it('should handle negative yearrent values', () => {
      const yearrentrows = JSON.stringify([
        { yearrent: 120000 },
        { yearrent: -12000 },
      ])
      const result = calculateMonthlyRent(yearrentrows)

      expect(result).toBe(9000) // 108000 / 12
    })
  })
})
