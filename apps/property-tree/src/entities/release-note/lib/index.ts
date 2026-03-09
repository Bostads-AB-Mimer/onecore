import type { ReleaseNote } from '../model/types'

/**
 * Format a release note date in Swedish locale
 */
export function formatReleaseNoteDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Sort release notes with pinned items first, preserving date order otherwise
 */
export function sortReleaseNotesByPinned(notes: ReleaseNote[]): ReleaseNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0 // Keep original order (already sorted by date)
  })
}
