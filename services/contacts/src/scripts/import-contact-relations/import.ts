import { Knex } from 'knex'
import {
  insertMany,
  listActiveByCreator,
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
import { reconcile } from './reconcile'

/** `created_by` / `deleted_by` value for every row this script writes. */
export const IMPORT_ACTOR = 'xpand-import'

export type ImportReport = {
  dryRun: boolean
  desired: Record<RoleType, number>
  inserted: number
  softDeleted: number
  unchanged: number
  conflicts: Conflict[]
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
 * result. Idempotent: rerunning against unchanged data writes nothing.
 * All writes happen in one transaction; `dryRun` skips them entirely.
 */
export const runImport = async ({
  xpandDb,
  contactsDb,
  now = new Date(),
  dryRun = false,
}: {
  xpandDb: Knex
  contactsDb: Knex
  now?: Date
  dryRun?: boolean
}): Promise<ImportReport> => {
  const [guardians, candidates] = await Promise.all([
    allGuardianEdges(xpandDb),
    allInvoiceRecipientCandidates(xpandDb, now),
  ])
  const { edges: recipients, conflicts } = collapseInvoiceRecipients(candidates)
  const desired = [...guardians, ...recipients]

  const existing = await listActiveByCreator(contactsDb, IMPORT_ACTOR)
  const plan = reconcile(
    desired,
    existing,
    new Set(conflicts.map((c) => c.holderContactCode))
  )

  if (!dryRun) {
    await contactsDb.transaction(async (trx) => {
      await insertMany(trx, plan.toInsert, IMPORT_ACTOR)
      await softDeleteByIds(trx, plan.toDelete, IMPORT_ACTOR)
    })
  }

  return {
    dryRun,
    desired: countByRole(desired),
    inserted: plan.toInsert.length,
    softDeleted: plan.toDelete.length,
    unchanged: plan.unchangedCount,
    conflicts,
  }
}
