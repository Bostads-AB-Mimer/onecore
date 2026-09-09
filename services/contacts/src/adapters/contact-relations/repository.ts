import { Knex } from 'knex'
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

const chunked = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
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
 */
export const softDeleteByIds = async (
  db: Knex,
  ids: string[],
  deletedBy: string
): Promise<void> => {
  const now = new Date()
  for (const chunk of chunked(ids, DELETE_CHUNK_SIZE)) {
    await db(TABLE)
      .whereIn('id', chunk)
      .whereNull('deleted_at')
      .update({ deleted_at: now, deleted_by: deletedBy })
  }
}

/**
 * All active rows touching any of the given contact codes, in either
 * direction (as subject or as related). The caller decides the perspective.
 * Codes are trimmed; the stored codes are already trimmed by the writers.
 */
export const activeRelationsForMany = async (
  db: Knex,
  contactCodes: string[]
): Promise<DbContactRelationRow[]> => {
  const codes = contactCodes.map((c) => c.trim()).filter((c) => c.length > 0)
  if (codes.length === 0) return []
  const rows: DbContactRelationRow[] = await db(TABLE)
    .whereNull('deleted_at')
    .andWhere((q) =>
      q
        .whereIn('subject_contact_code', codes)
        .orWhereIn('related_contact_code', codes)
    )
  return rows
}
