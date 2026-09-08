import Personnummer from 'personnummer'

/**
 * The two digit-only forms a Swedish personal identity number can take.
 *
 * Both are needed for lookups: Xpand stores the twelve-digit form for the vast
 * majority of private individuals, but a small number of contacts — and most
 * organisations — are stored with ten digits, and some rows carry a separator.
 * Matching on only one form silently misses those and would let us create a
 * duplicate contact that cannot be undone.
 */
export type NationalIdForms = {
  /** `YYYYMMDDNNNN` */
  twelveDigits: string
  /** `YYMMDDNNNN` */
  tenDigits: string
}

/**
 * Options used consistently wherever we parse an identity number.
 *
 * Coordination numbers (samordningsnummer) are allowed: they are issued to
 * people without a personnummer, who can perfectly well be housing customers.
 * Interim numbers are not — they are internal placeholders, not identities.
 */
const PARSE_OPTIONS = {
  allowCoordinationNumber: true,
  allowInterimNumber: false,
}

/**
 * Parses a Swedish personal identity number in any common notation and returns
 * its digit-only forms.
 *
 * Accepts `YYMMDD-NNNN`, `YYYYMMDDNNNN`, `YYMMDD+NNNN` (the `+` marking someone
 * over 100) and unseparated variants. Century is inferred by the parser rather
 * than guessed, which is why ten-digit input can be widened safely.
 *
 * @returns null when the input is not a valid identity number — including a
 *          correct-looking number with a bad checksum.
 */
export const parseNationalId = (input: string): NationalIdForms | null => {
  if (!Personnummer.valid(input, PARSE_OPTIONS)) return null

  const parsed = Personnummer.parse(input, PARSE_OPTIONS)
  const suffix = `${parsed.month}${parsed.day}${parsed.num}${parsed.check}`

  return {
    twelveDigits: `${parsed.fullYear}${suffix}`,
    tenDigits: `${parsed.year}${suffix}`,
  }
}

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * Birth date as `YYYY-MM-DD`, or null when the input is not a valid identity
 * number.
 *
 * Not derivable by slicing the digits: a coordination number carries its day
 * offset by 60, so `19550114+60` is stored as `19550174`. Slicing yields day 74,
 * which is not a date at all — Xpand rejects the whole envelope as an invalid
 * `xs:dateTime`, making coordination-number customers impossible to create.
 * `getDate()` applies the offset, so the rule lives in the library rather than
 * as a magic `-60` of our own.
 *
 * Returned as a plain date string rather than a `Date` so no caller has to
 * reason about which timezone the value is anchored in.
 */
export const getBirthDateFromNationalId = (input: string): string | null => {
  if (!Personnummer.valid(input, PARSE_OPTIONS)) return null

  // getDate() builds the Date from an ISO date string, so it is UTC midnight —
  // read it back with UTC getters or a negative offset shifts it a day.
  const date = Personnummer.parse(input, PARSE_OPTIONS).getDate()

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('-')
}

/**
 * Age in whole years, or null when the input is not a valid identity number.
 *
 * Used to enforce the minimum age for housing applicants.
 */
export const getAgeFromNationalId = (input: string): number | null => {
  if (!Personnummer.valid(input, PARSE_OPTIONS)) return null
  return Personnummer.parse(input, PARSE_OPTIONS).getAge()
}
