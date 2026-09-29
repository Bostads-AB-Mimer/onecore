import {
  DbContactRelationRow,
  isGuardianRole,
  RelationEdge,
  ROLE_TYPES,
  RoleType,
} from '@src/adapters/contact-relations'

/**
 * An Xpand edge the import left unwritten because the subject already has an
 * active row in the same slot (guardian, or fakturamottagare) that the import
 * may not remove.
 */
export type SkippedEdge = {
  subjectContactCode: string
  desired: RelationEdge
  existing: {
    relatedContactCode: string
    roleType: RoleType
    createdBy: string
  }
}

export type ReconcilePlan = {
  /** Deduped desired edges with no active row yet, whoever would own it. */
  toInsert: RelationEdge[]
  /** Ids of import-owned rows that are undesired or redundant duplicates. */
  toDelete: string[]
  /** Desired edges already covered by an active row. */
  unchangedCount: number
  /** Rows kept only because their holder is a conflict this run. */
  protectedCount: number
  /** Xpand guardian edges not written because the subject already has an active guardian the import may not remove (typically set by a caseworker). */
  skippedGuardians: SkippedEdge[]
  /** The same for annan_fakturamottagare edges. */
  skippedRecipients: SkippedEdge[]
}

type Slot = 'guardian' | 'recipient'

const slotOf = (roleType: RoleType): Slot =>
  isGuardianRole(roleType) ? 'guardian' : 'recipient'

/** The row holding a subject's slot, from an existing row or this run. */
type SlotHolder = SkippedEdge['existing']

/**
 * A total order over edges, so which guardian wins a contested subject is
 * decided here rather than by the order rows came back in.
 */
const edgeOrder = (a: RelationEdge, b: RelationEdge): number =>
  a.subjectContactCode.localeCompare(b.subjectContactCode) ||
  ROLE_TYPES.indexOf(a.roleType) - ROLE_TYPES.indexOf(b.roleType) ||
  a.relatedContactCode.localeCompare(b.relatedContactCode)

const keyOf = (e: RelationEdge): string =>
  JSON.stringify([e.subjectContactCode, e.relatedContactCode, e.roleType])

// Desired edges arrive trimmed and MSSQL ignores trailing blanks, so a padded
// stored code is the same code to the unique indexes. Untrimmed, it reads as a
// different edge and plans an insert the index rejects, aborting the import.
const rowToEdge = (r: DbContactRelationRow): RelationEdge => ({
  subjectContactCode: r.subject_contact_code.trim(),
  relatedContactCode: r.related_contact_code.trim(),
  roleType: r.role_type,
})

const oldestFirst = (a: DbContactRelationRow, b: DbContactRelationRow) =>
  a.created_at.getTime() - b.created_at.getTime() || (a.id < b.id ? -1 : 1)

/**
 * Computes what to write so that `contact_relation` mirrors `desired`.
 *
 * - `existing` must be *all* active rows, so an edge someone else already
 *   created is not inserted a second time. Only rows created by `ownedBy` may
 *   be deleted; anyone else's rows are left alone and left uncounted.
 * - One active row per edge survives: extra import-owned rows for the same
 *   edge are deleted (oldest kept), and an import-owned row that merely
 *   duplicates someone else's row is dropped in favour of theirs — a backstop
 *   for rows written before the unique index (migration 202609101000).
 * - Only one active guardian and one active fakturamottagare per subject, so
 *   an edge is skipped (and reported in `skippedGuardians` or
 *   `skippedRecipients`) when a row this run does not delete already holds
 *   that slot — a caseworker's, or an earlier edge in this same run.
 * - `conflictHolders` are holders whose fakturamottagare could not be
 *   collapsed. Their import-owned annan_fakturamottagare rows are left as-is
 *   so a rerun cannot silently remove a previously imported recipient because
 *   the Xpand data became ambiguous. Such a holder never appears in `desired`
 *   for that role (collapse puts each holder in either edges or conflicts), so
 *   the exception only ever suppresses deletes.
 */
export const reconcile = (
  desired: RelationEdge[],
  existing: DbContactRelationRow[],
  conflictHolders: Set<string>,
  ownedBy: string
): ReconcilePlan => {
  const desiredByKey = new Map<string, RelationEdge>()
  for (const e of desired) desiredByKey.set(keyOf(e), e)

  const existingByKey = new Map<string, DbContactRelationRow[]>()
  for (const r of existing) {
    const key = keyOf(rowToEdge(r))
    existingByKey.set(key, [...(existingByKey.get(key) ?? []), r])
  }

  const toDelete: string[] = []
  let unchangedCount = 0
  let protectedCount = 0

  for (const [key, rows] of existingByKey) {
    const owned = rows.filter((r) => r.created_by === ownedBy).sort(oldestFirst)
    const keptByOthers = rows.length > owned.length

    if (desiredByKey.has(key)) {
      unchangedCount += 1
      // Someone else's row already covers the edge, so every import-owned row
      // is redundant; otherwise keep our oldest one.
      toDelete.push(...owned.slice(keptByOthers ? 0 : 1).map((r) => r.id))
      continue
    }

    const isProtected = owned.some(
      (r) =>
        r.role_type === 'annan_fakturamottagare' &&
        conflictHolders.has(r.subject_contact_code)
    )
    if (isProtected) {
      protectedCount += owned.length
      continue
    }

    toDelete.push(...owned.map((r) => r.id))
  }

  // The row holding each subject's slot once this run's deletes are applied.
  const slotKey = (subject: string, roleType: RoleType) =>
    JSON.stringify([subject, slotOf(roleType)])
  const deletedIds = new Set(toDelete)
  const keptSlots = new Map<string, DbContactRelationRow>()
  for (const r of existing) {
    if (deletedIds.has(r.id)) continue
    const key = slotKey(r.subject_contact_code.trim(), r.role_type)
    const current = keptSlots.get(key)
    if (!current || oldestFirst(r, current) < 0) keptSlots.set(key, r)
  }

  const slotHolders = new Map<string, SlotHolder>(
    [...keptSlots].map(([key, r]) => [
      key,
      {
        relatedContactCode: r.related_contact_code.trim(),
        roleType: r.role_type,
        createdBy: r.created_by,
      },
    ])
  )

  const toInsert: RelationEdge[] = []
  const skipped: Record<Slot, SkippedEdge[]> = { guardian: [], recipient: [] }
  for (const edge of [...desiredByKey.values()].sort(edgeOrder)) {
    if (existingByKey.has(keyOf(edge))) continue

    const key = slotKey(edge.subjectContactCode, edge.roleType)
    const blocking = slotHolders.get(key)
    if (blocking) {
      skipped[slotOf(edge.roleType)].push({
        subjectContactCode: edge.subjectContactCode,
        desired: edge,
        existing: blocking,
      })
      continue
    }

    toInsert.push(edge)
    // This edge now holds the subject's slot, so a later edge for the same
    // slot is skipped rather than colliding.
    slotHolders.set(key, {
      relatedContactCode: edge.relatedContactCode,
      roleType: edge.roleType,
      createdBy: ownedBy,
    })
  }

  return {
    toInsert,
    toDelete,
    unchangedCount,
    protectedCount,
    skippedGuardians: skipped.guardian,
    skippedRecipients: skipped.recipient,
  }
}
