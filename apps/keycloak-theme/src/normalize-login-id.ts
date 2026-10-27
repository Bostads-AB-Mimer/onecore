// Normalizes what the user types into the canonical Keycloak username before the
// form is posted: personnummer -> 12 digits, organisationsnummer -> 10 digits.
// Anything else is left untouched (and simply fails to log in).
// Bundled by `pnpm build` into theme/mimer/login/resources/js/normalize-login-id.global.js.
import Personnummer from 'personnummer'

// Same options as parseNationalId in services/contacts/src/domain/national-id.ts,
// so the login accepts the same numbers that contacts creates accounts from.
const PARSE_OPTIONS = {
  allowCoordinationNumber: true,
  allowInterimNumber: false,
}

const pad = (value: number): string => String(value).padStart(2, '0')

const toDateKey = (year: number, month: number, day: number): string =>
  `${year}${pad(month)}${pad(day)}`

// Organisation numbers always have 20 or more in the "month" position
const isOrganisationNumber = (tenDigits: string): boolean =>
  Number(tenDigits.slice(2, 4)) >= 20

/**
 * The twelve-digit form of a valid personnummer or samordningsnummer.
 *
 * For ten-digit input the library picks the century from the year alone, so on
 * 2026-10-27 `261028-1236` becomes 2026-10-28, a birth date in the future. Such
 * a person was born in 1926 (and is 99, so `-` is the right separator).
 * Twelve-digit input is kept as typed: its century was not inferred.
 */
function toTwelveDigits(input: string): string {
  const parsed = Personnummer.parse(input, PARSE_OPTIONS)
  const rest = `${parsed.month}${parsed.day}${parsed.num}${parsed.check}`
  if (input.replace(/\D/g, '').length === 12) return `${parsed.fullYear}${rest}`

  // getDate() applies the samordningsnummer day offset and is UTC midnight
  const birth = parsed.getDate()
  const now = new Date()
  let year = Number(parsed.fullYear)
  if (
    toDateKey(year, birth.getUTCMonth() + 1, birth.getUTCDate()) >
    toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
  ) {
    year -= 100
  }

  return `${year}${rest}`
}

export function normalizeLoginId(input: unknown): string {
  const raw = String(input ?? '').trim()
  const compact = raw.replace(/\s/g, '')
  if (Personnummer.valid(compact, PARSE_OPTIONS)) return toTwelveDigits(compact)

  const digits = compact.replace(/\D/g, '')
  if (digits.length === 10 && isOrganisationNumber(digits)) return digits
  if (digits.length === 12) {
    // '16' is the century prefix organisationsnummer get in their 12-digit form
    if (digits.startsWith('16') && isOrganisationNumber(digits.slice(2)))
      return digits.slice(2)
    // Twelve digits carry their own century; only the separator is dropped,
    // even when the check digit is wrong
    return digits
  }
  return raw
}

/** Rewrites the username field of any form on the page before it is posted. */
export function normalizeOnSubmit(target: Pick<Document, 'addEventListener'>) {
  target.addEventListener(
    'submit',
    (e) => {
      const form = e.target as HTMLFormElement | null
      const field = form?.querySelector?.<HTMLInputElement>(
        'input[name="username"]'
      )
      if (field) field.value = normalizeLoginId(field.value)
    },
    true
  )
}

if (typeof document !== 'undefined') normalizeOnSubmit(document)
