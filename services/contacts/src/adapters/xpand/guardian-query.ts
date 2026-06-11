import knex from 'knex'
import { ContactCode } from '@src/domain'
import { RelatedContact, RelatedContactRole } from '@src/domain/contact'

const REDACTED_CONTACT_CODE = 'RENSAD_GDPR'
const ADMINISTRATOR_FORVTYP = 2

const ROLE_BY_FORVTYP: Record<number, RelatedContactRole> = {
  1: 'trustee',
  2: 'administrator',
}

type RelatedRow = {
  contactCode: string | null
  fullName: string | null
  protectedIdentity: unknown
  forvtyp?: number | null
}

const RELATED_COLUMNS = [
  'related.cmctckod as contactCode',
  'related.cmctcben as fullName',
  'related.lagsokt as protectedIdentity',
]

const redactName = (
  fullName: string | null,
  protectedIdentity: unknown
): string => (protectedIdentity !== null ? 'redacted' : (fullName ?? '').trim())

const toRelatedContact = (
  row: RelatedRow,
  role?: RelatedContactRole
): RelatedContact | null => {
  const contactCode = row.contactCode?.trim()
  if (!contactCode || contactCode === REDACTED_CONTACT_CODE) return null
  return {
    contactCode,
    role: role ?? ROLE_BY_FORVTYP[row.forvtyp as number],
    fullName: redactName(row.fullName, row.protectedIdentity),
  }
}

const toRelatedContacts = (
  rows: RelatedRow[],
  role?: RelatedContactRole
): RelatedContact[] =>
  rows
    .map((row) => toRelatedContact(row, role))
    .filter((rc): rc is RelatedContact => rc !== null)

export type GuardianRelationsResult = {
  subjectExists: boolean
  related: RelatedContact[]
}

/** The contact's förvaltare. */
export const guardianRelations = async (
  db: knex.Knex,
  contactCode: ContactCode
): Promise<GuardianRelationsResult> => {
  const rows = await db('cmctc as subject')
    .leftJoin('cmctc as related', function () {
      this.on('subject.keycmctc2', 'related.keycmctc').andOn(
        'subject.forvtyp',
        '=',
        db.raw('?', [ADMINISTRATOR_FORVTYP])
      )
    })
    .whereRaw('TRIM(subject.cmctckod) = ?', [contactCode.trim()])
    .select(...RELATED_COLUMNS)

  return {
    subjectExists: rows.length > 0,
    related: toRelatedContacts(rows, 'administrator'),
  }
}

/** The contacts the given contact is förvaltare for. */
export const wardRelations = async (
  db: knex.Knex,
  contactCode: ContactCode
): Promise<GuardianRelationsResult> => {
  const rows = await db('cmctc as subject')
    .leftJoin('cmctc as related', function () {
      this.on('related.keycmctc2', 'subject.keycmctc').andOn(
        'related.forvtyp',
        '=',
        db.raw('?', [ADMINISTRATOR_FORVTYP])
      )
    })
    .whereRaw('TRIM(subject.cmctckod) = ?', [contactCode.trim()])
    .select(...RELATED_COLUMNS)

  return {
    subjectExists: rows.length > 0,
    related: toRelatedContacts(rows, 'ward'),
  }
}

/**
 * Each subject's god man/förvaltare plus the contacts it is guardian for, for
 * many subjects in two queries. Keyed by trimmed contactCode.
 */
export const relatedContactsForMany = async (
  db: knex.Knex,
  contactCodes: ContactCode[]
): Promise<Map<string, RelatedContact[]>> => {
  const result = new Map<string, RelatedContact[]>()
  if (contactCodes.length === 0) return result

  const trimmed = contactCodes.map((c) => c.trim())
  const placeholders = trimmed.map(() => '?').join(', ')
  const inSubjectCodes = `TRIM(subject.cmctckod) IN (${placeholders})`

  const forwardRows = await db('cmctc as subject')
    .innerJoin('cmctc as related', 'subject.keycmctc2', 'related.keycmctc')
    .whereRaw(inSubjectCodes, trimmed)
    .whereIn('subject.forvtyp', [1, 2])
    .select(
      'subject.cmctckod as subjectCode',
      ...RELATED_COLUMNS,
      'subject.forvtyp as forvtyp'
    )

  const wardRows = await db('cmctc as subject')
    .innerJoin('cmctc as related', 'related.keycmctc2', 'subject.keycmctc')
    .whereRaw(inSubjectCodes, trimmed)
    .whereIn('related.forvtyp', [1, 2])
    .select('subject.cmctckod as subjectCode', ...RELATED_COLUMNS)

  const push = (
    subjectCode: string | null,
    row: RelatedRow,
    role?: RelatedContactRole
  ) => {
    const key = subjectCode?.trim()
    const related = toRelatedContact(row, role)
    if (!key || !related) return
    if (!result.has(key)) result.set(key, [])
    result.get(key)!.push(related)
  }

  for (const row of forwardRows) push(row.subjectCode, row)
  for (const row of wardRows) push(row.subjectCode, row, 'ward')

  return result
}

/** Single-contact form of relatedContactsForMany. */
export const relatedContactsFor = async (
  db: knex.Knex,
  contactCode: ContactCode
): Promise<RelatedContact[]> =>
  (await relatedContactsForMany(db, [contactCode])).get(contactCode.trim()) ??
  []
