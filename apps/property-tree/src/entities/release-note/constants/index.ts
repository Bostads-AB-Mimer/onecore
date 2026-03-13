import { AlertTriangle, Bug, Info, Sparkles, Zap } from 'lucide-react'

import type { ReleaseNote, ReleaseNoteCategory } from '../model/types'

/**
 * Auto-import all release note JSON files from the data folder.
 * To add a new release, just create a new JSON file: YYYY-MM-DD-vX.X.X.json
 * No need to update this file!
 */
const releaseModules = import.meta.glob<ReleaseNote[]>('../data/*.json', {
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

/**
 * Icons for each release note category
 */
export const RELEASE_NOTE_CATEGORY_ICONS: Record<
  ReleaseNoteCategory,
  React.ElementType
> = {
  feature: Sparkles,
  fix: Bug,
  improvement: Zap,
  info: Info,
  warning: AlertTriangle,
}

/**
 * Badge styles for each release note category
 */
export const RELEASE_NOTE_BADGE_STYLES: Record<ReleaseNoteCategory, string> = {
  feature: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  fix: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  improvement:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  warning:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

/**
 * Icon container styles for each release note category
 */
export const RELEASE_NOTE_ICON_STYLES: Record<ReleaseNoteCategory, string> = {
  feature: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  fix: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  improvement:
    'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  info: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  warning:
    'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
}
