import {
  getAgeFromNationalId,
  getBirthDateFromNationalId,
  parseNationalId,
} from '@src/domain/national-id'

// Checksum-valid number used only in these unit tests. Nothing here reaches a
// real system; end-to-end runs use numbers from Skatteverket's reserved test set.
const VALID_TWELVE = '199007292387'
const VALID_TEN = '9007292387'
const VALID_HYPHENATED = '900729-2387'
/** Same birth date as VALID_TWELVE, with the day offset by 60. */
const VALID_COORDINATION = '199007890016'

describe('parseNationalId', () => {
  it('returns both digit forms for twelve-digit input', () => {
    expect(parseNationalId(VALID_TWELVE)).toEqual({
      twelveDigits: '199007292387',
      tenDigits: '9007292387',
    })
  })

  it('widens ten-digit input to twelve by inferring the century', () => {
    expect(parseNationalId(VALID_TEN)).toEqual({
      twelveDigits: '199007292387',
      tenDigits: '9007292387',
    })
  })

  it('accepts hyphenated notation', () => {
    expect(parseNationalId(VALID_HYPHENATED)).toEqual({
      twelveDigits: '199007292387',
      tenDigits: '9007292387',
    })
  })

  // The duplicate check compares normalised forms on both sides. If these
  // three notations did not collapse to the same pair, a caseworker typing a
  // hyphen would create a duplicate contact that cannot be undone.
  it('collapses every accepted notation to the same forms', () => {
    const forms = [VALID_TWELVE, VALID_TEN, VALID_HYPHENATED].map(
      parseNationalId
    )

    expect(forms[0]).toEqual(forms[1])
    expect(forms[1]).toEqual(forms[2])
  })

  it('rejects a number with a bad checksum', () => {
    expect(parseNationalId('199007292388')).toBeNull()
  })

  it('rejects non-identity input', () => {
    expect(parseNationalId('')).toBeNull()
    expect(parseNationalId('inte ett personnummer')).toBeNull()
    expect(parseNationalId('12345')).toBeNull()
  })
})

describe('getBirthDateFromNationalId', () => {
  it('returns the birth date of an ordinary number', () => {
    expect(getBirthDateFromNationalId(VALID_TWELVE)).toBe('1990-07-29')
  })

  it('accepts ten-digit and hyphenated notation', () => {
    expect(getBirthDateFromNationalId(VALID_TEN)).toBe('1990-07-29')
    expect(getBirthDateFromNationalId(VALID_HYPHENATED)).toBe('1990-07-29')
  })

  /**
   * The regression this guards: slicing the digits of a coordination number
   * yields day 89, which Xpand rejects as an invalid xs:dateTime — making
   * coordination-number customers impossible to create even though the
   * validation deliberately accepts them.
   */
  it('subtracts the day offset of a coordination number', () => {
    expect(getBirthDateFromNationalId(VALID_COORDINATION)).toBe('1990-07-29')
  })

  it('returns null for an invalid number', () => {
    expect(getBirthDateFromNationalId('199007292388')).toBeNull()
    expect(getBirthDateFromNationalId('')).toBeNull()
  })
})

describe('getAgeFromNationalId', () => {
  it('returns a plausible age for a valid number', () => {
    const age = getAgeFromNationalId(VALID_TWELVE)

    expect(age).not.toBeNull()
    expect(age).toBeGreaterThan(16)
    expect(age).toBeLessThan(120)
  })

  it('returns null for an invalid number', () => {
    expect(getAgeFromNationalId('199007292388')).toBeNull()
  })
})
