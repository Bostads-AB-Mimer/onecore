import { Knex } from 'knex'
import { chunked } from '@src/common/chunked'
import { DbContactRelationRow, RoleType } from './db-model'

/**
 * A directed relation edge: `subject` has `related` in the given role.
 * For god_man/forvaltare the subject is the huvudman; for
 * annan_fakturamottagare the subject is the lease holder.
 */
export type RelationEdge = {
  subjectContactCode: string
  relatedContactCode: string
  roleType: RoleType
}

const TABLE = 'contact_relation'

// MSSQL rejects a statement with 2100 or more parameters. Derive the insert
// chunk from the column count; keep INSERT_COLUMN_COUNT in sync with the
// insert below (the chunk-boundary test fails loudly if it drifts). The delete
// chunk is bounded by the whereIn list.
const MSSQL_PARAM_BUDGET = 2000
const INSERT_COLUMN_COUNT = 4
const INSERT_CHUNK_SIZE = Math.floor(MSSQL_PARAM_BUDGET / INSERT_COLUMN_COUNT)
const DELETE_CHUNK_SIZE = 500
// Each code is bound twice on the read (subject OR related), against once per
// code in the writers' statements.
const READ_CHUNK_SIZE = Math.floor(MSSQL_PARAM_BUDGET / 2)

export type RelationDirection = 'subject' | 'related'

const DIRECTION_COLUMN: Record<RelationDirection, string> = {
  subject: 'subject_contact_code',
  related: 'related_contact_code',
}

/** Every row that has not been soft-deleted, whoever created it. */
export const listActive = async (db: Knex): Promise<DbContactRelationRow[]> => {
  const rows: DbContactRelationRow[] = await db(TABLE).whereNull('deleted_at')
  return rows
}

// insertMany and softDeleteByIds are no-ops on empty input. The caller owns
// the transaction; chunks are separate statements.

/** Inserts one row per edge, attributed to `createdBy`. */
export const insertMany = async (
  db: Knex,
  edges: RelationEdge[],
  createdBy: string
): Promise<void> => {
  for (const chunk of chunked(edges, INSERT_CHUNK_SIZE)) {
    await db(TABLE).insert(
      chunk.map((e) => ({
        subject_contact_code: e.subjectContactCode,
        related_contact_code: e.relatedContactCode,
        role_type: e.roleType,
        created_by: createdBy,
      }))
    )
  }
}

/**
 * Soft-deletes the given rows (by id), attributed to `deletedBy`. Rows that
 * are already soft-deleted are left untouched.
 *
 * Returns how many rows this call actually deleted, which is what tells a
 * caller apart from one that lost a race: the `deleted_at IS NULL` guard makes
 * the update a no-op for a row someone else soft-deleted in between.
 */
export const softDeleteByIds = async (
  db: Knex,
  ids: string[],
  deletedBy: string
): Promise<number> => {
  const now = new Date()
  let deleted = 0
  for (const chunk of chunked(ids, DELETE_CHUNK_SIZE)) {
    deleted += await db(TABLE)
      .whereIn('id', chunk)
      .whereNull('deleted_at')
      .update({ deleted_at: now, deleted_by: deletedBy })
  }
  return deleted
}

/**
 * All active rows touching any of the given contact codes, in either
 * direction (as subject or as related), each row at most once. The caller
 * decides the perspective. Requested codes are trimmed; stored codes are
 * expected to be trimmed by whoever inserts them (today only the Xpand
 * import, which trims before building edges).
 */
export const activeRelationsForMany = async (
  db: Knex,
  contactCodes: string[]
): Promise<DbContactRelationRow[]> => {
  const codes = [
    ...new Set(contactCodes.map((c) => c.trim()).filter((c) => c.length > 0)),
  ]
  if (codes.length === 0) return []

  // Either endpoint matches, so a row whose subject falls in one chunk and
  // whose related falls in another comes back from both queries. Key by id
  // to hand each row out once.
  const byId = new Map<string, DbContactRelationRow>()
  for (const chunk of chunked(codes, READ_CHUNK_SIZE)) {
    const found: DbContactRelationRow[] = await db(TABLE)
      .whereNull('deleted_at')
      .andWhere((q) =>
        q
          .whereIn('subject_contact_code', chunk)
          .orWhereIn('related_contact_code', chunk)
      )
      .orderBy('created_at')
      .orderBy('id')
    for (const row of found) byId.set(row.id, row)
  }
  return [...byId.values()]
}

/**
 * The active rows for one contact code in one role type, on the given side of
 * the edge — what the single-role endpoints need, without reading the
 * contact's other relations. Covered by
 * `idx_contact_relation_subject`/`_related`.
 *
 * Ordered so that a caller taking the first row gets a stable answer; since
 * migration 202609101000 the filtered unique indexes also guarantee at most
 * one active guardian per subject.
 */
export const activeRelationsInRole = async (
  db: Knex,
  contactCode: string,
  roleType: RoleType,
  direction: RelationDirection
): Promise<DbContactRelationRow[]> => {
  const code = contactCode.trim()
  if (code.length === 0) return []

  const rows: DbContactRelationRow[] = await db(TABLE)
    .whereNull('deleted_at')
    .where('role_type', roleType)
    .where(DIRECTION_COLUMN[direction], code)
    .orderBy('created_at')
    .orderBy('id')
  return rows
}
