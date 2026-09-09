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
 * Whether a contact with the given code exists in Xpand.
 */
export const contactExists = async (
  db: Knex,
  contactCode: ContactCode
): Promise<boolean> => {
  const trimmed = contactCode.trim()
  if (trimmed.length === 0) return false

  const row = await db('cmctc')
    .whereRaw('TRIM(cmctckod) = ?', [trimmed])
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
