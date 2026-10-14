import { hasIndefiniteActiveBlock } from '../../helpers/rental-object-availability-helpers'
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
})
