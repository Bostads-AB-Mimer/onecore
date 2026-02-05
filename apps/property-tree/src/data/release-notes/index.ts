import type { ReleaseNote, ReleaseNoteCategory } from '@/services/types'

/**
 * Auto-import all release note JSON files from this folder
 * To add a new release, just create a new JSON file: YYYY-MM-DD-vX.X.X.json
 * No need to update this file!
 */
const releaseModules = import.meta.glob<ReleaseNote[]>('./*.json', {
  eager: true,
  import: 'default',
})

export const RELEASE_NOTES: ReleaseNote[] = Object.values(releaseModules)
  .flat()
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

/**
 * Swedish labels for release note categories
 */
export const RELEASE_NOTE_CATEGORY_LABELS: Record<ReleaseNoteCategory, string> =
  {
    feature: 'Ny funktion',
    fix: 'Buggfix',
    improvement: 'Förbättring',
    info: 'Info',
    warning: 'Information',
  }
