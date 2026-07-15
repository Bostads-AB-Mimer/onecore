import { isRentalObjectRequirementException } from '@src/common/config'

describe(isRentalObjectRequirementException, () => {
  it('returns true for the configured exception article code', () => {
    expect(isRentalObjectRequirementException('FAKT AVG')).toBe(true)
  })

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(isRentalObjectRequirementException('fakt avg')).toBe(true)
    expect(isRentalObjectRequirementException('  FAKT AVG  ')).toBe(true)
  })

  it('returns false for a non-exception article code', () => {
    expect(isRentalObjectRequirementException('HYRAB')).toBe(false)
  })

  it('returns false for missing/empty article codes', () => {
    expect(isRentalObjectRequirementException(undefined)).toBe(false)
    expect(isRentalObjectRequirementException(null)).toBe(false)
    expect(isRentalObjectRequirementException('')).toBe(false)
  })
})
