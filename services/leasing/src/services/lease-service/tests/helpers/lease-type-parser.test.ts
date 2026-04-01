import { LeaseType } from '@onecore/types'

import { parseLeaseType } from '../../helpers/lease-type-parser'

describe('parseLeaseType', () => {
  it.each(Object.values(LeaseType))('maps exact value "%s" to itself', (value) => {
    expect(parseLeaseType(value)).toBe(value)
  })

  it('trims trailing spaces (XPand padding)', () => {
    expect(parseLeaseType('Bostadskontrakt               ')).toBe(
      LeaseType.HousingContract
    )
  })

  it('trims leading spaces', () => {
    expect(parseLeaseType('   P-Platskontrakt')).toBe(
      LeaseType.ParkingSpaceContract
    )
  })

  it('falls back to OtherContract for unknown values', () => {
    expect(parseLeaseType('Okänd typ')).toBe(LeaseType.OtherContract)
  })

  it('falls back to OtherContract for empty string', () => {
    expect(parseLeaseType('')).toBe(LeaseType.OtherContract)
  })

  it('falls back to OtherContract for undefined', () => {
    expect(parseLeaseType(undefined)).toBe(LeaseType.OtherContract)
  })

  it('falls back to OtherContract for null', () => {
    expect(parseLeaseType(null)).toBe(LeaseType.OtherContract)
  })
})
