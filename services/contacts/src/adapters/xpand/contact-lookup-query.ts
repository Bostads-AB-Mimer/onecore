import { Knex } from 'knex'
import { ContactCode } from '@src/domain'

export type ContactName = {
  fullName: string
  firstName: string
  lastName: string
}

type NameRow = {
  contactCode: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  protectedIdentity: unknown
}

// GDPR: `lagsokt` is a presence sentinel — any non-null value means the
// identity is protected and every PII field is replaced by 'redacted'.
const redactField = (
  value: string | null | undefined,
  protectedIdentity: unknown
): string => (protectedIdentity !== null ? 'redacted' : (value ?? '').trim())

/**
 * Whether a contact with the given code exists in Xpand.
 */
export const contactExists = async (
  db: Knex,
  contactCode: ContactCode
): Promise<boolean> => {
  const row = await db('cmctc')
    .whereRaw('TRIM(cmctckod) = ?', [contactCode.trim()])
    .first('keycmctc')
  return row !== undefined
}

/**
 * Display names for a set of contact codes, redacted for protected
 * identities. Unknown codes are absent from the result.
 */
export const contactNamesByCodes = async (
  db: Knex,
  contactCodes: ContactCode[]
): Promise<Map<string, ContactName>> => {
  const result = new Map<string, ContactName>()
  const trimmed = contactCodes.map((c) => c.trim()).filter((c) => c.length > 0)
  if (trimmed.length === 0) return result

  const placeholders = trimmed.map(() => '?').join(', ')
  const rows: NameRow[] = await db('cmctc')
    .whereRaw(`TRIM(cmctckod) IN (${placeholders})`, trimmed)
    .select(
      'cmctckod as contactCode',
      'cmctcben as fullName',
      'fnamn as firstName',
      'enamn as lastName',
      'lagsokt as protectedIdentity'
    )

  for (const row of rows) {
    result.set(row.contactCode.trim(), {
      fullName: redactField(row.fullName, row.protectedIdentity),
      firstName: redactField(row.firstName, row.protectedIdentity),
      lastName: redactField(row.lastName, row.protectedIdentity),
    })
  }
  return result
}
