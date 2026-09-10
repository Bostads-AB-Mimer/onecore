import {
  DbContactRelationRow,
  RelationEdge,
  RoleType,
} from '@src/adapters/contact-relations'

/**
 * An Xpand guardian edge the import left unwritten because the subject
 * already has an active guardian row the import may not remove.
 */
export type SkippedGuardian = {
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
  skippedGuardians: SkippedGuardian[]
}

/** The guardian a subject ends up with, from an existing row or this run. */
type SurvivingGuardian = SkippedGuardian['existing']

const isGuardianRole = (roleType: RoleType): boolean =>
  roleType === 'god_man' || roleType === 'forvaltare'

const keyOf = (e: RelationEdge): string =>
  JSON.stringify([e.subjectContactCode, e.relatedContactCode, e.roleType])

// Desired edges arrive trimmed from Xpand, and MSSQL ignores trailing blanks
// when comparing, so a padded stored code is the same code to the unique
// indexes. Trimming here keeps a padded row matchable: seeing it as a
// different edge would plan an insert the index then rejects, and since
// migration 202609101000 that aborts the whole import.
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
 *   duplicates someone else's row is dropped in favour of theirs. Duplicate
 *   active edges are prevented by the unique index (migration
 *   202609101000), so that branch is now a backstop for rows written before
 *   it existed.
 * - A guardian edge is skipped when the subject already has an active
 *   guardian row (in either guardian role) that this run does not delete —
 *   typically one a caseworker set — or when an earlier edge in this same run
 *   already claimed the subject. The unique index allows only one active
 *   guardian per subject, so inserting anyway would fail the whole run; the
 *   edge is reported in `skippedGuardians` instead.
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

  // The guardian each subject still has once this run's deletes are applied.
  const deletedIds = new Set(toDelete)
  const keptGuardians = new Map<string, DbContactRelationRow>()
  for (const r of existing) {
    if (!isGuardianRole(r.role_type) || deletedIds.has(r.id)) continue
    const subject = r.subject_contact_code.trim()
    const current = keptGuardians.get(subject)
    if (!current || oldestFirst(r, current) < 0) keptGuardians.set(subject, r)
  }

  const survivingGuardians = new Map<string, SurvivingGuardian>(
    [...keptGuardians].map(([subject, r]) => [
      subject,
      {
        relatedContactCode: r.related_contact_code.trim(),
        roleType: r.role_type,
        createdBy: r.created_by,
      },
    ])
  )

  const toInsert: RelationEdge[] = []
  const skippedGuardians: SkippedGuardian[] = []
  for (const [key, edge] of desiredByKey) {
    if (existingByKey.has(key)) continue

    const isGuardian = isGuardianRole(edge.roleType)
    const blocking = isGuardian
      ? survivingGuardians.get(edge.subjectContactCode)
      : undefined
    if (blocking) {
      skippedGuardians.push({
        subjectContactCode: edge.subjectContactCode,
        desired: edge,
        existing: blocking,
      })
      continue
    }

    toInsert.push(edge)
    // This edge now holds the subject's single guardian slot, so a later
    // guardian edge for the same subject is skipped rather than colliding.
    if (isGuardian) {
      survivingGuardians.set(edge.subjectContactCode, {
        relatedContactCode: edge.relatedContactCode,
        roleType: edge.roleType,
        createdBy: ownedBy,
      })
    }
  }

  return {
    toInsert,
    toDelete,
    unchangedCount,
    protectedCount,
    skippedGuardians,
  }
}
