import { getAgeFromNationalId } from './national-id'
import { swedishYear } from './swedish-time'

/**
 * How a person's age is counted when a contact is created.
 *
 * - `exact-age`: 16 on the day. Caseworkers creating a contact use this.
 * - `birth-year`: from the calendar year the person turns 16, as public
 *   registration on Mina sidor has always promised.
 */
export type AgeRule = 'exact-age' | 'birth-year'

/**
 * The minimum age for a contact we provision a web account for. Mirrors the
 * public registration flow, which refuses applicants under 16.
 */
export const MINIMUM_AGE = 16

/**
 * Whether the person is old enough under `rule`. Both rules count in Swedish
 * time, so the day and the year turn at midnight in Sweden.
 *
 * The single copy of this rule: the contacts service applies it when creating
 * a contact, and core checks it before registration starts, so the two cannot
 * disagree.
 *
 * @param twelveDigits the national ID in its twelve-digit form. The year is
 *   read from it directly: a samordningsnummer only offsets the day, so its
 *   first four digits are still the birth year.
 */
export const isOldEnough = (
  twelveDigits: string,
  rule: AgeRule,
  today: Date
): boolean => {
  if (rule === 'birth-year') {
    const birthYear = Number(twelveDigits.slice(0, 4))
    return swedishYear(today) - birthYear >= MINIMUM_AGE
  }
  const age = getAgeFromNationalId(twelveDigits, today)
  return age !== null && age >= MINIMUM_AGE
}
