import { Knex } from 'knex'
import {
  insertMany,
  listActive,
  softDeleteByIds,
  RelationEdge,
  RoleType,
  ROLE_TYPES,
} from '@src/adapters/contact-relations'
import {
  allGuardianEdges,
  allInvoiceRecipientCandidates,
} from '@src/adapters/xpand/relation-import-query'
import { collapseInvoiceRecipients, Conflict } from './collapse'
import { reconcile, SkippedGuardian } from './reconcile'

export const IMPORT_ACTOR = 'xpand-import'

// A run that removes most of what it owns is far more likely to be pointed at
// the wrong database than to reflect a real change in Xpand, so it needs
// `force`. Below MIN_ROWS a large share proves nothing (one of two rows
// legitimately disappearing is 50%).
const DELETE_GUARD_MIN_ROWS = 10
const DELETE_GUARD_MAX_SHARE = 0.2

export type ImportReport = {
  dryRun: boolean
  desired: Record<RoleType, number>
  inserted: number
  softDeleted: number
  unchanged: number
  protected: number
  conflicts: Conflict[]
  skippedGuardians: SkippedGuardian[]
}

const countByRole = (edges: RelationEdge[]): Record<RoleType, number> => {
  const counts = Object.fromEntries(ROLE_TYPES.map((r) => [r, 0])) as Record<
    RoleType,
    number
  >
  for (const e of edges) counts[e.roleType] += 1
  return counts
}

/**
 * Reads today's relations from Xpand, collapses fakturamottagare to contact
 * level, and makes the import-owned rows in `contact_relation` mirror the
 * result. Idempotent: rerunning against unchanged data writes nothing. All
 * writes happen in one transaction; `dryRun` skips them entirely.
 *
 * A guardian someone else has set wins: the Xpand edge is reported in
 * `skippedGuardians` instead of being written, since only one active guardian
 * per subject is allowed and the import may not remove another actor's row.
 *
 * `inserted`/`softDeleted`/`unchanged`/`protected` on the returned report are
 * the planned counts from the reconcile step, not affected-row counts read
 * back from the database. `now` is the as-of date used only for lease and
 * relation validity in Xpand, never for the written rows: `created_at` uses
 * the database clock (`GETUTCDATE()`), `deleted_at` the writing process's
 * clock. Throws rather than writing when the plan deletes an implausible
 * share of the import's own rows, unless `force` is set.
 */
export const runImport = async ({
  xpandDb,
  contactsDb,
  now = new Date(),
  dryRun = false,
  force = false,
}: {
  xpandDb: Knex
  contactsDb: Knex
  now?: Date
  dryRun?: boolean
  force?: boolean
}): Promise<ImportReport> => {
  const [guardians, candidates] = await Promise.all([
    allGuardianEdges(xpandDb),
    allInvoiceRecipientCandidates(xpandDb, now),
  ])
  const { edges: recipients, conflicts } = collapseInvoiceRecipients(candidates)
  const desired = [...guardians, ...recipients]

  const existing = await listActive(contactsDb)
  const plan = reconcile(
    desired,
    existing,
    new Set(conflicts.map((c) => c.holderContactCode)),
    IMPORT_ACTOR
  )

  if (!dryRun) {
    const ownedCount = existing.filter(
      (r) => r.created_by === IMPORT_ACTOR
    ).length
    if (
      !force &&
      ownedCount >= DELETE_GUARD_MIN_ROWS &&
      plan.toDelete.length > ownedCount * DELETE_GUARD_MAX_SHARE
    ) {
      throw new Error(
        `Refusing to soft-delete ${plan.toDelete.length} of ${ownedCount} rows owned by ${IMPORT_ACTOR}. ` +
          'Check that XPAND_DATABASE__* and CONTACTS_DATABASE__* point at the databases you intend, ' +
          'then rerun with --force if this is really the change you want.'
      )
    }

    await contactsDb.transaction(async (trx) => {
      // Deletes go first: a subject whose guardian changed has both a delete
      // and an insert planned, and the unique index on the active guardian
      // rejects the insert while the old row is still active.
      await softDeleteByIds(trx, plan.toDelete, IMPORT_ACTOR)
      await insertMany(trx, plan.toInsert, IMPORT_ACTOR)
    })
  }

  return {
    dryRun,
    desired: countByRole(desired),
    inserted: plan.toInsert.length,
    softDeleted: plan.toDelete.length,
    unchanged: plan.unchangedCount,
    protected: plan.protectedCount,
    conflicts,
    skippedGuardians: plan.skippedGuardians,
  }
}
