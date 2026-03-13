export type ReleaseNoteCategory =
  | 'feature'
  | 'fix'
  | 'improvement'
  | 'info'
  | 'warning'

export interface ReleaseNote {
  id: string
  date: string // ISO date string, e.g., '2026-02-03'
  title: string
  description: string
  category: ReleaseNoteCategory
  pinned?: boolean // Pinned items always appear at the top
}
