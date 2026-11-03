import { parseNationalId } from './national-id'

const SEPARATORS = /[-+]/g

/**
 * Fewest digits before a search word is matched against national ids. Six is a
 * full birth date; anything shorter would return everyone born in a given month.
 */
export const NATIONAL_ID_MIN_DIGITS = 6

/**
 * Prefixes to match against the separator-stripped `persorgnr` column, or an
 * empty list when the word cannot be the start of a national id.
 *
 * A complete, checksum-valid number resolves to exactly its twelve- and
 * ten-digit forms, century included (so `+` for someone over 100 works).
 *
 * A partial number has no checksum to lean on, and Xpand stores most
 * individuals with twelve digits but thousands with ten, so a prefix typed one
 * way is also tried the other way: with the century stripped, and with both
 * plausible centuries prepended. The extra candidates can match other rows,
 * which is accepted for a partial search; a missing one silently hides a row.
 */
export const nationalIdPrefixes = (word: string): string[] => {
  const complete = parseNationalId(word)
  if (complete) return [complete.twelveDigits, complete.tenDigits]

  const digits = word.replace(SEPARATORS, '')
  if (!/^\d+$/.test(digits)) return []
  if (digits.length < NATIONAL_ID_MIN_DIGITS || digits.length > 12) return []

  const candidates = new Set<string>([digits])

  if (/^(19|20)/.test(digits) && digits.length >= 8) {
    candidates.add(digits.slice(2))
  }
  if (digits.length <= 10) {
    candidates.add(`19${digits}`)
    candidates.add(`20${digits}`)
  }

  return [...candidates]
}
