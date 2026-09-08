import {
  DbContactRelationRow,
  RelationEdge,
} from '@src/adapters/contact-relations'

export type ReconcilePlan = {
  toInsert: RelationEdge[]
  toDelete: string[]
  unchangedCount: number
  protectedCount: number
}

const keyOf = (e: RelationEdge): string =>
  JSON.stringify([e.subjectContactCode, e.relatedContactCode, e.roleType])

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
 *
 * Return fields: `toInsert` are deduped desired edges with no active
 * import-owned row; `toDelete` are ids of import-owned rows no longer
 * desired; `unchangedCount` counts existing rows whose key is desired (not
 * desired edges matched — they differ if duplicates exist); `protectedCount`
 * counts rows kept only because of the conflict-holder exception. A conflict
 * holder never appears in `desired` for annan_fakturamottagare (collapse
 * puts each holder in either edges or conflicts), so the exception only ever
 * suppresses deletes.
 */
export const reconcile = (
  desired: RelationEdge[],
  existing: DbContactRelationRow[],
  conflictHolders: Set<string>
): ReconcilePlan => {
  const desiredByKey = new Map<string, RelationEdge>()
  for (const e of desired) desiredByKey.set(keyOf(e), e)

  const existingKeys = new Set<string>()
  const toDelete: string[] = []
  let unchangedCount = 0
  let protectedCount = 0
  for (const r of existing) {
    const key = keyOf(rowToEdge(r))
    existingKeys.add(key)
    if (desiredByKey.has(key)) {
      unchangedCount += 1
      continue
    }
    if (
      r.role_type === 'annan_fakturamottagare' &&
      conflictHolders.has(r.subject_contact_code)
    ) {
      protectedCount += 1
      continue
    }
    toDelete.push(r.id)
  }

  const toInsert = [...desiredByKey.values()].filter(
    (e) => !existingKeys.has(keyOf(e))
  )

  return { toInsert, toDelete, unchangedCount, protectedCount }
}
