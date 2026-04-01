import {
  hasNoActiveBlock,
  determineVacantFrom,
} from '../../helpers/rental-object-availability-helpers'
import { RentalObjectFactory } from '../factories/rental-object'

describe('rental-object-availability-helpers', () => {
  const TODAY = new Date('2026-03-31T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(TODAY)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('hasNoActiveBlock', () => {
    it('returns true when there is no blockStartDate', () => {
      const ps = RentalObjectFactory.build()
      expect(hasNoActiveBlock(ps)).toBe(true)
    })

    it('returns true when block starts in the future and has no end date', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-04-01'),
      })
      expect(hasNoActiveBlock(ps)).toBe(true)
    })

    it('returns false when block started today and has no end date', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-03-31'),
      })
      expect(hasNoActiveBlock(ps)).toBe(false)
    })

    it('returns false when block started in the past and has no end date', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-03-01'),
      })
      expect(hasNoActiveBlock(ps)).toBe(false)
    })

    it('returns false when today is within the block period', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-03-01'),
        blockEndDate: new Date('2026-04-30'),
      })
      expect(hasNoActiveBlock(ps)).toBe(false)
    })

    it('returns false when block ends today', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-03-01'),
        blockEndDate: new Date('2026-03-31'),
      })
      expect(hasNoActiveBlock(ps)).toBe(false)
    })

    it('returns true when block ended yesterday', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-03-01'),
        blockEndDate: new Date('2026-03-30'),
      })
      expect(hasNoActiveBlock(ps)).toBe(true)
    })

    it('returns true when block starts and ends in the future', () => {
      const ps = RentalObjectFactory.build({
        blockStartDate: new Date('2026-04-01'),
        blockEndDate: new Date('2026-04-30'),
      })
      expect(hasNoActiveBlock(ps)).toBe(true)
    })
  })

  describe('determineVacantFrom', () => {
    it('returns the day after blockEndDate when it is in the future', () => {
      const result = determineVacantFrom(undefined, '2026-03-01', '2026-04-15')
      expect(result).toEqual(new Date('2026-04-16T00:00:00.000Z'))
    })

    it('returns the day after blockEndDate when it is today', () => {
      const result = determineVacantFrom(undefined, '2026-03-01', '2026-03-31')
      expect(result).toEqual(new Date('2026-04-01T00:00:00.000Z'))
    })

    it('returns undefined when blockStartDate exists but blockEndDate does not', () => {
      const result = determineVacantFrom(undefined, '2026-03-01', null)
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

    it('returns today when there is no block and no vacantFromDate', () => {
      const result = determineVacantFrom(undefined, null, null)
      expect(result).toEqual(new Date('2026-03-31T00:00:00.000Z'))
    })

    it('returns vacantFromDate as-is when blockEndDate is in the past', () => {
      const result = determineVacantFrom(
        new Date('2026-03-15T00:00:00.000Z'),
        '2026-03-01',
        '2026-03-20'
      )
      expect(result).toEqual(new Date('2026-03-15T00:00:00.000Z'))
    })

    it('returns today when blockEndDate is in the past and there is no vacantFromDate', () => {
      const result = determineVacantFrom(undefined, '2026-03-01', '2026-03-20')
      expect(result).toEqual(new Date('2026-03-31T00:00:00.000Z'))
    })
  })
})
