import knex from 'knex'
import { ContactCode } from '@src/domain'
import { RelatedContact, RelatedContactRole } from '@src/domain/contact'

// ───────────────────────────── Section 1: shared primitives ─────────────────

export type RelationsResult = {
  subjectExists: boolean
  related: RelatedContact[]
}

const ANNANFM = 'ANNANFM'
const INNEHAVARE = 'INNEHAVARE'

const ROLE_BY_FORVTYP: Record<number, RelatedContactRole> = {
  1: 'trustee',
  2: 'administrator',
}

// Reverse direction: the subject is the god man/förvaltare *for* the related
// contact (the related contact is the subject's huvudman).
const REVERSE_ROLE_BY_FORVTYP: Record<number, RelatedContactRole> = {
  1: 'trusteeFor',
  2: 'administratorFor',
}

export const TRUSTEE_FORVTYP = 1
export const ADMINISTRATOR_FORVTYP = 2
const GUARDIAN_FORVTYPS = Object.keys(ROLE_BY_FORVTYP).map(Number)

type RelatedRow = {
  subjectCode?: string | null
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

// A role is either fixed (invoice directions) or derived from the row's
// forvtyp (guardian directions, via ROLE_BY_FORVTYP / REVERSE_ROLE_BY_FORVTYP).
type RoleSpec = RelatedContactRole | Record<number, RelatedContactRole>

const resolveRole = (
  spec: RoleSpec,
  forvtyp: number | null | undefined
): RelatedContactRole | undefined =>
  typeof spec === 'string' ? spec : forvtyp != null ? spec[forvtyp] : undefined

const toRelatedContact = (
  row: RelatedRow,
  spec: RoleSpec
): RelatedContact | null => {
  const contactCode = row.contactCode?.trim()
  if (!contactCode) return null

  const role = resolveRole(spec, row.forvtyp)
  if (!role) return null

  return {
    contactCode,
    role,
    fullName: redactName(row.fullName, row.protectedIdentity),
  }
}

const dedupe = (related: RelatedContact[]): RelatedContact[] => {
  const seen = new Set<string>()
  return related.filter((r) => {
    const key = `${r.contactCode} ${r.role}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const collect = (rows: RelatedRow[], spec: RoleSpec): RelatedContact[] =>
  dedupe(
    rows
      .map((row) => toRelatedContact(row, spec))
      .filter((r): r is RelatedContact => r !== null)
  )

// Active lease + currently-valid relation row, expressed as raw ON predicates.
// knex `raw` predicates are single-use bindings: a fresh pair must be built for
// every query because the same `Raw` instance cannot be reused across `.andOn`
// chains without corrupting its bindings — don't "simplify" by hoisting these.
const currentRelation = (db: knex.Knex, alias: string, now: Date) => [
  db.raw(`${alias}.fdate <= ?`, [now]),
  db.raw(`(${alias}.tdate IS NULL OR ${alias}.tdate >= ?)`, [now]),
]

const whereSubjectIn = (
  query: knex.Knex.QueryBuilder,
  subjectCodes: string[]
): knex.Knex.QueryBuilder => {
  const placeholders = subjectCodes.map(() => '?').join(', ')
  return query.whereRaw(
    `TRIM(subject.cmctckod) IN (${placeholders})`,
    subjectCodes
  )
}

const subjectExists = async (
  db: knex.Knex,
  contactCode: ContactCode
): Promise<boolean> => {
  const row = await db('cmctc')
    .whereRaw('TRIM(cmctckod) = ?', [contactCode.trim()])
    .first('keycmctc')
  return row !== undefined
}

// ───────────────────────────── Section 2: row builders ──────────────────────

/**
 * The subject(s)' god man/förvaltare. `subject.keycmctc2` points at the
 * guardian, filtered to the requested `forvtyps`. Role is derived from
 * `subject.forvtyp` by {@link collect}.
 */
const guardianRows = (
  db: knex.Knex,
  subjectCodes: string[],
  forvtyps: number[]
): Promise<RelatedRow[]> =>
  whereSubjectIn(
    db('cmctc as subject')
      .innerJoin('cmctc as related', 'subject.keycmctc2', 'related.keycmctc')
      .whereIn('subject.forvtyp', forvtyps),
    subjectCodes
  ).select(
    'subject.cmctckod as subjectCode',
    ...RELATED_COLUMNS,
    'subject.forvtyp as forvtyp'
  )

/**
 * The contacts the subject(s) is guardian for: `related.keycmctc2` points back
 * at the subject, filtered to the requested `forvtyps`. The reverse role
 * (trusteeFor/administratorFor) is derived from `related.forvtyp`.
 */
const guardianForRows = (
  db: knex.Knex,
  subjectCodes: string[],
  forvtyps: number[]
): Promise<RelatedRow[]> =>
  whereSubjectIn(
    db('cmctc as subject')
      .innerJoin('cmctc as related', 'related.keycmctc2', 'subject.keycmctc')
      .whereIn('related.forvtyp', forvtyps),
    subjectCodes
  ).select(
    'subject.cmctckod as subjectCode',
    ...RELATED_COLUMNS,
    'related.forvtyp as forvtyp'
  )

/**
 * Forward traversal: the ANNANFM recipients on the leases the subject(s)
 * currently hold. The dependent ANNANFM + recipient cmctc hang off the active
 * `o` (hyobj, sistadeb IS NULL) alias, preserving terminated-lease
 * correctness. INNER joins — we only want matched relations.
 */
const invoiceRecipientRows = (
  db: knex.Knex,
  subjectCodes: string[],
  now: Date
): Promise<RelatedRow[]> => {
  const [tenFrom, tenTo] = currentRelation(db, 'ten', now)
  const [fmFrom, fmTo] = currentRelation(db, 'fm', now)

  return whereSubjectIn(
    db('cmctc as subject')
      .innerJoin('hyavk as ten', function () {
        this.on('ten.keycmctc', 'subject.keycmctc')
          .andOn(db.raw('TRIM(ten.keyhyakt) = ?', [INNEHAVARE]))
          .andOn(tenFrom)
          .andOn(tenTo)
      })
      .innerJoin('hyobj as o', function () {
        this.on('o.keyhyobj', 'ten.keyhyobj').andOn(
          db.raw('o.sistadeb IS NULL')
        )
      })
      .innerJoin('hyavk as fm', function () {
        this.on('fm.keyhyobj', 'o.keyhyobj')
          .andOn(db.raw('TRIM(fm.keyhyakt) = ?', [ANNANFM]))
          .andOn(fmFrom)
          .andOn(fmTo)
      })
      .innerJoin('cmctc as fm_c', 'fm_c.keycmctc', 'fm.keycmctc'),
    subjectCodes
  ).select(
    'subject.cmctckod as subjectCode',
    'fm_c.cmctckod as contactCode',
    'fm_c.cmctcben as fullName',
    'fm_c.lagsokt as protectedIdentity'
  )
}

/**
 * Reverse traversal: the current lease holders the subject(s) are the ANNANFM
 * recipient for. Mirror of {@link invoiceRecipientRows}; the dependent
 * INNEHAVARE + holder cmctc hang off the active `o` alias.
 */
const tenantRows = (
  db: knex.Knex,
  subjectCodes: string[],
  now: Date
): Promise<RelatedRow[]> => {
  const [fmFrom, fmTo] = currentRelation(db, 'fm', now)
  const [tenFrom, tenTo] = currentRelation(db, 'ten', now)

  return whereSubjectIn(
    db('cmctc as subject')
      .innerJoin('hyavk as fm', function () {
        this.on('fm.keycmctc', 'subject.keycmctc')
          .andOn(db.raw('TRIM(fm.keyhyakt) = ?', [ANNANFM]))
          .andOn(fmFrom)
          .andOn(fmTo)
      })
      .innerJoin('hyobj as o', function () {
        this.on('o.keyhyobj', 'fm.keyhyobj').andOn(db.raw('o.sistadeb IS NULL'))
      })
      .innerJoin('hyavk as ten', function () {
        this.on('ten.keyhyobj', 'o.keyhyobj')
          .andOn(db.raw('TRIM(ten.keyhyakt) = ?', [INNEHAVARE]))
          .andOn(tenFrom)
          .andOn(tenTo)
      })
      .innerJoin('cmctc as ten_c', 'ten_c.keycmctc', 'ten.keycmctc'),
    subjectCodes
  ).select(
    'subject.cmctckod as subjectCode',
    'ten_c.cmctckod as contactCode',
    'ten_c.cmctcben as fullName',
    'ten_c.lagsokt as protectedIdentity'
  )
}

// ───────────────── Section 3: single-contact directional queries ────────────
//
// The guardian queries take a single forvtyp (TRUSTEE_FORVTYP /
// ADMINISTRATOR_FORVTYP); the batch aggregator widens to both.

/** The subject's god man/förvaltare for the given forvtyp (role derived from it). */
export const guardianRelations = async (
  db: knex.Knex,
  contactCode: ContactCode,
  forvtyp: number
): Promise<RelationsResult> => {
  const [exists, rows] = await Promise.all([
    subjectExists(db, contactCode),
    guardianRows(db, [contactCode.trim()], [forvtyp]),
  ])
  return { subjectExists: exists, related: collect(rows, ROLE_BY_FORVTYP) }
}

/** The contacts the subject is god man/förvaltare for, for the given forvtyp. */
export const guardianForRelations = async (
  db: knex.Knex,
  contactCode: ContactCode,
  forvtyp: number
): Promise<RelationsResult> => {
  const [exists, rows] = await Promise.all([
    subjectExists(db, contactCode),
    guardianForRows(db, [contactCode.trim()], [forvtyp]),
  ])
  return {
    subjectExists: exists,
    related: collect(rows, REVERSE_ROLE_BY_FORVTYP),
  }
}

/**
 * Forward: the ANNANFM recipients on the leases this contact currently holds.
 */
export const otherInvoiceRecipientRelations = async (
  db: knex.Knex,
  contactCode: ContactCode,
  now: Date
): Promise<RelationsResult> => {
  const [exists, rows] = await Promise.all([
    subjectExists(db, contactCode),
    invoiceRecipientRows(db, [contactCode.trim()], now),
  ])
  return {
    subjectExists: exists,
    related: collect(rows, 'otherInvoiceRecipient'),
  }
}

/**
 * Reverse: the current lease holders this contact is the ANNANFM recipient for.
 */
export const otherInvoiceRecipientForRelations = async (
  db: knex.Knex,
  contactCode: ContactCode,
  now: Date
): Promise<RelationsResult> => {
  const [exists, rows] = await Promise.all([
    subjectExists(db, contactCode),
    tenantRows(db, [contactCode.trim()], now),
  ])
  return {
    subjectExists: exists,
    related: collect(rows, 'otherInvoiceRecipientFor'),
  }
}

// ───────────────────────────── Section 4: aggregator ────────────────────────

/**
 * All of a subject's related contacts keyed by trimmed contactCode — god
 * man/förvaltare and their inverses plus annan fakturamottagare (both
 * directions) — each from one grouped query (no N+1). Widens to
 * GUARDIAN_FORVTYPS so the bake-in carries both god man and förvaltare.
 */
export const relatedContactsForMany = async (
  db: knex.Knex,
  contactCodes: ContactCode[],
  now: Date = new Date()
): Promise<Map<string, RelatedContact[]>> => {
  const result = new Map<string, RelatedContact[]>()
  if (contactCodes.length === 0) return result

  const trimmed = contactCodes.map((c) => c.trim())
  const [guardians, guardianFor, invoiceRecipients, tenants] =
    await Promise.all([
      guardianRows(db, trimmed, GUARDIAN_FORVTYPS),
      guardianForRows(db, trimmed, GUARDIAN_FORVTYPS),
      invoiceRecipientRows(db, trimmed, now),
      tenantRows(db, trimmed, now),
    ])

  const add = (rows: RelatedRow[], spec: RoleSpec) => {
    for (const row of rows) {
      const subjectCode = row.subjectCode?.trim()
      const related = toRelatedContact(row, spec)
      if (!subjectCode || !related) continue
      const list = result.get(subjectCode) ?? []
      list.push(related)
      result.set(subjectCode, list)
    }
  }
  add(guardians, ROLE_BY_FORVTYP)
  add(guardianFor, REVERSE_ROLE_BY_FORVTYP)
  add(invoiceRecipients, 'otherInvoiceRecipient')
  add(tenants, 'otherInvoiceRecipientFor')

  for (const [code, list] of result) result.set(code, dedupe(list))
  return result
}

export const relatedContactsFor = async (
  db: knex.Knex,
  contactCode: ContactCode
): Promise<RelatedContact[]> =>
  (await relatedContactsForMany(db, [contactCode])).get(contactCode.trim()) ??
  []
