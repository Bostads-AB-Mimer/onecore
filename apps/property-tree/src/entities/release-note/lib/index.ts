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

export type ReleaseNoteStatus = 'draft' | 'scheduled' | 'published'

// A future publishedAt means the note is scheduled and not yet visible.
export function getReleaseNoteStatus(
  note: Pick<ReleaseNote, 'publishedAt'>
): ReleaseNoteStatus {
  if (!note.publishedAt) return 'draft'
  return new Date(note.publishedAt).getTime() > Date.now()
    ? 'scheduled'
    : 'published'
}
