import { Knex } from 'knex'
import { ContactCode } from '@src/domain'
import { chunked } from '@src/common/chunked'
import { DbContactName } from './db-model'
import { ContactName, toContactName } from './transform'

// MSSQL rejects queries with 2100+ parameters; one binding per code here.
const LOOKUP_CHUNK_SIZE = 1000

const NAME_COLUMNS = [
  'cmctckod as contactCode',
  'cmctcben as fullName',
  'fnamn as firstName',
  'enamn as lastName',
  'lagsokt as protectedIdentity',
]

/**
 * The contact code as Xpand spells it, or null when there is no such contact.
 *
 * Xpand collates case-insensitively, so it answers a lookup for `p000111` with
 * the contact stored as `P000111`. Anything that *persists* a code has to store
 * this form: the read path keys Xpand names by the code Xpand returned
 * (`contactNamesByCodes` below), so a row written in the caller's casing is
 * dropped from every kundkort while still counting towards the unique indexes.
 */
export const canonicalContactCode = async (
  db: Knex,
  contactCode: ContactCode
): Promise<string | null> => {
  const trimmed = contactCode.trim()
  if (trimmed.length === 0) return null

  const row: { contactCode: string } | undefined = await db('cmctc')
    .whereRaw('TRIM(cmctckod) = ?', [trimmed])
    .first('cmctckod as contactCode')
  return row ? row.contactCode.trim() : null
}

/**
 * Whether a contact with the given code exists in Xpand.
 */
export const contactExists = async (
  db: Knex,
  contactCode: ContactCode
): Promise<boolean> => (await canonicalContactCode(db, contactCode)) !== null

/**
 * Display names for a set of contact codes, redacted for protected
 * identities. Unknown codes are absent from the result.
 */
export const contactNamesByCodes = async (
  db: Knex,
  contactCodes: ContactCode[]
): Promise<Map<string, ContactName>> => {
  const result = new Map<string, ContactName>()
  const trimmed = [
    ...new Set(contactCodes.map((c) => c.trim()).filter((c) => c.length > 0)),
  ]
  if (trimmed.length === 0) return result

  for (const chunk of chunked(trimmed, LOOKUP_CHUNK_SIZE)) {
    const placeholders = chunk.map(() => '?').join(', ')
    const rows: DbContactName[] = await db('cmctc')
      .whereRaw(`TRIM(cmctckod) IN (${placeholders})`, chunk)
      .select(NAME_COLUMNS)

    for (const row of rows) {
      result.set(row.contactCode.trim(), toContactName(row))
    }
  }
  return result
}
