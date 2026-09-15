import { parseOrganisationNumber } from '@src/domain/organisation-number'

// Checksum-valid numbers used only in these unit tests.
const VALID_TEN = '5560160680'
const VALID_HYPHENATED = '556016-0680'
const VALID_TWELVE = '165560160680'
/** A municipality-style number (group 21). */
const VALID_MUNICIPAL = '2120002098'
/** A checksum-valid personal identity number. */
const PERSONAL_IDENTITY_NUMBER = '9007292387'

describe('parseOrganisationNumber', () => {
  it('returns both digit forms for ten-digit input', () => {
    expect(parseOrganisationNumber(VALID_TEN)).toEqual({
      tenDigits: '5560160680',
      twelveDigits: '165560160680',
    })
  })

  it('accepts hyphenated notation', () => {
    expect(parseOrganisationNumber(VALID_HYPHENATED)).toEqual({
      tenDigits: '5560160680',
      twelveDigits: '165560160680',
    })
  })

  it('accepts the widened twelve-digit form', () => {
    expect(parseOrganisationNumber(VALID_TWELVE)).toEqual({
      tenDigits: '5560160680',
      twelveDigits: '165560160680',
    })
  })

  it('accepts surrounding and inner whitespace', () => {
    expect(parseOrganisationNumber(' 556016 0680 ')).toEqual({
      tenDigits: '5560160680',
      twelveDigits: '165560160680',
    })
  })

  // The duplicate check compares normalised forms on both sides. If these
  // notations did not collapse to the same pair, a caseworker typing a hyphen
  // would create a duplicate contact that cannot be undone.
  it('collapses every accepted notation to the same forms', () => {
    const forms = [VALID_TEN, VALID_HYPHENATED, VALID_TWELVE].map(
      parseOrganisationNumber
    )

    expect(forms[0]).toEqual(forms[1])
    expect(forms[1]).toEqual(forms[2])
  })

  it('accepts other legal forms than limited companies', () => {
    expect(parseOrganisationNumber(VALID_MUNICIPAL)).toEqual({
      tenDigits: '2120002098',
      twelveDigits: '162120002098',
    })
  })

  it('rejects a number with a bad checksum', () => {
    expect(parseOrganisationNumber('5560160681')).toBeNull()
  })

  /**
   * A personal identity number is checksum-valid too, so the checksum alone
   * cannot tell the two apart. Letting one through here would create a person
   * as a company — with the name split cleared and no birth date.
   */
  it('rejects a personal identity number', () => {
    expect(parseOrganisationNumber(PERSONAL_IDENTITY_NUMBER)).toBeNull()
    expect(parseOrganisationNumber('900729-2387')).toBeNull()
    expect(parseOrganisationNumber('199007292387')).toBeNull()
  })

  it('rejects non-identity input', () => {
    expect(parseOrganisationNumber('')).toBeNull()
    expect(parseOrganisationNumber('inte ett organisationsnummer')).toBeNull()
    expect(parseOrganisationNumber('12345')).toBeNull()
    expect(parseOrganisationNumber('55601606800')).toBeNull()
  })

  it('rejects a twelve-digit number without the 16 prefix', () => {
    expect(parseOrganisationNumber('195560160680')).toBeNull()
  })
})
