import {
  DbContactRelationRow,
  RelationEdge,
} from '@src/adapters/contact-relations'

export type ReconcilePlan = {
  toInsert: RelationEdge[]
  toDelete: string[]
  unchangedCount: number
}

const keyOf = (e: RelationEdge): string =>
  `${e.subjectContactCode}|${e.relatedContactCode}|${e.roleType}`

const rowToEdge = (r: DbContactRelationRow): RelationEdge => ({
  subjectContactCode: r.subject_contact_code,
  relatedContactCode: r.related_contact_code,
  roleType: r.role_type,
})

/**
 * Computes what to write so that the import-owned rows mirror `desired`.
 *
 * - `existing` must be the active rows created by the import itself; rows
 *   created by anyone else are never passed in and therefore never touched.
 * - `conflictHolders` are holders whose fakturamottagare could not be
 *   collapsed. Their existing annan_fakturamottagare rows are left as-is
 *   (neither inserted nor deleted) so a rerun cannot silently remove a
 *   previously imported recipient because the Xpand data became ambiguous.
 */
export const reconcile = (
  desired: RelationEdge[],
  existing: DbContactRelationRow[],
  conflictHolders: Set<string>
): ReconcilePlan => {
  const desiredByKey = new Map<string, RelationEdge>()
  for (const e of desired) desiredByKey.set(keyOf(e), e)

  const existingKeys = new Set(existing.map((r) => keyOf(rowToEdge(r))))

  const toInsert = [...desiredByKey.values()].filter(
    (e) => !existingKeys.has(keyOf(e))
  )

  const toDelete = existing
    .filter((r) => !desiredByKey.has(keyOf(rowToEdge(r))))
    .filter(
      (r) =>
        !(
          r.role_type === 'annan_fakturamottagare' &&
          conflictHolders.has(r.subject_contact_code)
        )
    )
    .map((r) => r.id)

  const unchangedCount = existing.filter((r) =>
    desiredByKey.has(keyOf(rowToEdge(r)))
  ).length

  return { toInsert, toDelete, unchangedCount }
}
