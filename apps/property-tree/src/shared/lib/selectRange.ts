/**
 * Returns the ids between anchorId and targetId (inclusive) in the order of
 * orderedIds, regardless of which one comes first. Used for shift-click range
 * selection in lists.
 *
 * If the anchor is missing from orderedIds (e.g. the page changed since the
 * last click) only the target is returned.
 */
export function getIdRange(
  orderedIds: string[],
  anchorId: string | null,
  targetId: string
): string[] {
  const targetIndex = orderedIds.indexOf(targetId)
  if (targetIndex === -1) return []

  const anchorIndex = anchorId === null ? -1 : orderedIds.indexOf(anchorId)
  if (anchorIndex === -1) return [targetId]

  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  return orderedIds.slice(start, end + 1)
}
