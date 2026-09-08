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

// MSSQL caps a statement at 2100 parameters; 4 columns × 500 rows stays well
// under it.
const CHUNK_SIZE = 500

const chunked = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

/**
 * All active (not soft-deleted) rows created by the given actor.
 */
export const listActiveByCreator = async (
  db: Knex,
  createdBy: string
): Promise<DbContactRelationRow[]> => {
  const rows: DbContactRelationRow[] = await db(TABLE)
    .where({ created_by: createdBy })
    .whereNull('deleted_at')
  return rows
}

/**
 * Inserts one row per edge, attributed to `createdBy`. No-op on empty input.
 */
export const insertMany = async (
  db: Knex,
  edges: RelationEdge[],
  createdBy: string
): Promise<void> => {
  for (const chunk of chunked(edges, CHUNK_SIZE)) {
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
 * are already soft-deleted are left untouched. No-op on empty input.
 */
export const softDeleteByIds = async (
  db: Knex,
  ids: string[],
  deletedBy: string
): Promise<void> => {
  const now = new Date()
  for (const chunk of chunked(ids, CHUNK_SIZE)) {
    await db(TABLE)
      .whereIn('id', chunk)
      .whereNull('deleted_at')
      .update({ deleted_at: now, deleted_by: deletedBy })
  }
}
