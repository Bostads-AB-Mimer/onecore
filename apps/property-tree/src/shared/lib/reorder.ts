import { arrayMove } from '@dnd-kit/sortable'

/**
 * dnd-kit's arrayMove, except that a no-op or out-of-range move returns the
 * same list instead of a copy. The guide editor's reducer relies on that
 * identity to tell a real reorder from one that changes nothing (e.g. a drag
 * dropped where it started), which must not mark the guide as unsaved.
 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list
  }
  return arrayMove(list, from, to)
}
