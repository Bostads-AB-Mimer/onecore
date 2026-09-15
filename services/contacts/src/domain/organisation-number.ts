import { NationalIdForms } from './national-id'

/**
 * Widens a ten-digit organisation number to twelve digits.
 *
 * Organisation numbers have no century, but a handful of systems — and a few
 * Xpand rows — store them as `16` + ten digits. Producing both forms keeps the
 * duplicate check identical to the one for personal identity numbers.
 */
const ORGANISATION_NUMBER_PREFIX = '16'

/**
 * A personal identity number carries a month in its third and fourth digits.
 * An organisation number carries a group number of 20 or higher there instead,
 * so the third digit alone separates the two: no person is born in month 20+.
 */
const MINIMUM_ORGANISATION_GROUP_DIGIT = 2

/**
 * Luhn checksum over a ten-digit number, as Skatteverket defines it for both
 * personal identity numbers and organisation numbers: digits are weighted
 * 2,1,2,1,… from the left, digit sums above nine are reduced by nine, and the
 * total must be divisible by ten.
 */
const hasValidLuhnChecksum = (digits: string): boolean => {
  let sum = 0

  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[index]) * (index % 2 === 0 ? 2 : 1)
    if (digit > 9) digit -= 9
    sum += digit
  }

  return sum % 10 === 0
}

/**
 * Parses a Swedish organisation number in any common notation and returns its
 * digit-only forms, shaped like a personal identity number so the same lookup
 * serves both.
 *
 * Accepts `NNNNNN-NNNN`, `NNNNNNNNNN` and the widened `16NNNNNNNNNN`, with or
 * without spaces. Rejects anything that parses as a personal identity number —
 * that is the caller's cue that the wrong kind of contact is being created.
 *
 * @returns null when the input is not a valid organisation number — including
 *          a correct-looking number with a bad checksum.
 */
export const parseOrganisationNumber = (
  input: string
): NationalIdForms | null => {
  const compact = input.replace(/[-\s]/g, '')

  const tenDigits =
    compact.length === 12 && compact.startsWith(ORGANISATION_NUMBER_PREFIX)
      ? compact.slice(ORGANISATION_NUMBER_PREFIX.length)
      : compact

  if (!/^\d{10}$/.test(tenDigits)) return null
  if (Number(tenDigits[2]) < MINIMUM_ORGANISATION_GROUP_DIGIT) return null
  if (!hasValidLuhnChecksum(tenDigits)) return null

  return {
    tenDigits,
    twelveDigits: `${ORGANISATION_NUMBER_PREFIX}${tenDigits}`,
  }
}
