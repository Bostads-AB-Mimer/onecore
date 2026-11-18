import Personnummer from 'personnummer'

import { swedishDate } from './swedish-time'

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
 * What Xpand puts in `birthdate` when it doesn't know it. It says nothing about
 * the century.
 */
const PLACEHOLDER_BIRTH_DATE = '1900-01-01'

export type CenturyMatch = 'same' | 'different' | 'unknown'

/**
 * Whether a contact found by personnummer belongs to someone born in the same
 * century as the person being looked up.
 *
 * Ten digits leave out the century, so a contact stored as `9005059846` matches
 * people born in both 1990 and 1890. Its century is then taken from:
 *
 * 1. `birthDate`, but only when it is the date in the number. A placeholder or
 *    a date that doesn't fit the number tells us nothing.
 * 2. A `+` separator in the stored value: the person was 100 or older when it
 *    was written.
 *
 * @param twelveDigits The personnummer being looked up, `YYYYMMDDNNNN`.
 * @param stored The contact's personnummer as Xpand stores it.
 * @param birthDate The contact's `birthdate` as `YYYY-MM-DD`, or null.
 * @returns 'unknown' when neither source says anything about the century.
 */
export const storedCenturyMatches = (
  twelveDigits: string,
  stored: string,
  birthDate: string | null
): CenturyMatch => {
  const lookedUp = getBirthDateFromNationalId(twelveDigits)
  if (!lookedUp) return 'unknown'

  // Twelve digits carry the century. Compared as digits, not parsed: the SQL
  // strips separators and spaces before matching, but the parser rejects a
  // value with a space and would drop a correct contact.
  const storedDigits = stored.replace(/\D/g, '')
  if (storedDigits.length === 12) {
    return storedDigits === twelveDigits ? 'same' : 'different'
  }

  // YY-MM-DD: the part of the date that ten digits do carry.
  if (
    birthDate &&
    birthDate !== PLACEHOLDER_BIRTH_DATE &&
    birthDate.slice(2) === lookedUp.slice(2)
  ) {
    return birthDate === lookedUp ? 'same' : 'different'
  }

  if (stored.includes('+')) {
    // The library reads `+` as 100 or older and picks the century from that.
    const fromPlus = getBirthDateFromNationalId(stored)
    if (fromPlus) return fromPlus === lookedUp ? 'same' : 'different'
  }

  return 'unknown'
}

/**
 * Age in whole years on the Swedish calendar date of `today`, or null when the
 * input is not a valid identity number.
 *
 * Not `Personnummer#getAge()`: that compares the clock with the birth date as
 * UTC midnight, so in Sweden a birthday only counts from 01:00 or 02:00. Both
 * dates are compared as `YYYY-MM-DD` instead, so a birthday counts from
 * midnight Swedish time. Someone born on 29 February gets a year older on
 * 1 March in other years.
 *
 * Used to enforce the minimum age for housing applicants.
 */
export const getAgeFromNationalId = (
  input: string,
  today: Date
): number | null => {
  const birthDate = getBirthDateFromNationalId(input)
  if (!birthDate) return null

  const todayDate = swedishDate(today)
  const years = Number(todayDate.slice(0, 4)) - Number(birthDate.slice(0, 4))
  // MM-DD compares correctly as a string, being fixed-width.
  return todayDate.slice(5) < birthDate.slice(5) ? years - 1 : years
}
