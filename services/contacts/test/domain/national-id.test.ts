import {
  getAgeFromNationalId,
  getBirthDateFromNationalId,
  parseNationalId,
  storedCenturyMatches,
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
  /** Born 29 February 2008, so their birthday is missing in other years. */
  const LEAP_DAY = '200802292383'

  it('counts whole years on the given date', () => {
    expect(
      getAgeFromNationalId(VALID_TWELVE, new Date('2026-07-28T12:00:00Z'))
    ).toBe(35)
    expect(
      getAgeFromNationalId(VALID_TWELVE, new Date('2026-07-29T12:00:00Z'))
    ).toBe(36)
  })

  it('reads the birth date of a samordningsnummer', () => {
    expect(
      getAgeFromNationalId(VALID_COORDINATION, new Date('2026-07-29T12:00:00Z'))
    ).toBe(36)
  })

  it('turns a year older at midnight in Sweden, not in UTC', () => {
    // 00:30 on 29 July in Sweden (CEST), still 28 July in UTC.
    expect(
      getAgeFromNationalId(VALID_TWELVE, new Date('2026-07-28T22:30:00Z'))
    ).toBe(36)
    // 23:30 on 28 July in Sweden: the day before, in both time zones.
    expect(
      getAgeFromNationalId(VALID_TWELVE, new Date('2026-07-28T21:30:00Z'))
    ).toBe(35)
  })

  it('makes someone born on 29 February a year older on 1 March in other years', () => {
    expect(
      getAgeFromNationalId(LEAP_DAY, new Date('2026-02-28T12:00:00Z'))
    ).toBe(17)
    expect(
      getAgeFromNationalId(LEAP_DAY, new Date('2026-03-01T12:00:00Z'))
    ).toBe(18)
  })

  it('returns null for an invalid number', () => {
    expect(getAgeFromNationalId('199007292388', new Date())).toBeNull()
  })
})

describe('storedCenturyMatches', () => {
  // The same ten digits, born in 1905 and in 2005.
  const BORN_1905 = '190505059816'
  const BORN_2005 = '200505059816'
  const STORED_TEN = '050505-9816'

  it('is the same for a twelve-digit contact with the same number', () => {
    expect(storedCenturyMatches(BORN_2005, '200505059816', null)).toBe('same')
  })

  // The SQL strips spaces before matching, the parser rejects them. Twelve
  // digits carry the century, so comparing the digits is enough.
  it('is the same for a twelve-digit contact the parser rejects', () => {
    expect(storedCenturyMatches(BORN_2005, '20050505 9816', null)).toBe('same')
  })

  it('is different for a twelve-digit contact from another century', () => {
    expect(storedCenturyMatches(BORN_2005, '190505059816', null)).toBe(
      'different'
    )
  })

  it('takes the century from birthdate when it is the date in the number', () => {
    expect(storedCenturyMatches(BORN_1905, STORED_TEN, '1905-05-05')).toBe(
      'same'
    )
    expect(storedCenturyMatches(BORN_2005, STORED_TEN, '1905-05-05')).toBe(
      'different'
    )
  })

  it('reads a coordination number against the real birth date', () => {
    // Day 65 in the number is the 5th.
    expect(
      storedCenturyMatches('200505659854', '050565-9854', '1905-05-05')
    ).toBe('different')
    expect(
      storedCenturyMatches('190505659854', '050565-9854', '1905-05-05')
    ).toBe('same')
  })

  it('ignores the 1900-01-01 placeholder', () => {
    expect(
      storedCenturyMatches('200001019843', '000101-9843', '1900-01-01')
    ).toBe('unknown')
  })

  it('ignores a birthdate that is not the date in the number', () => {
    expect(storedCenturyMatches(BORN_2005, STORED_TEN, '1967-03-12')).toBe(
      'unknown'
    )
  })

  it('falls back to a + separator: 100 or older', () => {
    expect(storedCenturyMatches('191006069825', '100606+9825', null)).toBe(
      'same'
    )
    expect(storedCenturyMatches('201006069825', '100606+9825', null)).toBe(
      'different'
    )
  })

  it('prefers birthdate over the separator', () => {
    expect(
      storedCenturyMatches('201006069825', '100606+9825', '2010-06-06')
    ).toBe('same')
  })

  it('is unknown without birthdate or +', () => {
    expect(storedCenturyMatches(BORN_2005, STORED_TEN, null)).toBe('unknown')
    expect(storedCenturyMatches(BORN_1905, '0505059816', null)).toBe('unknown')
  })
})
