import { AlertTriangle, Bug, Info, Sparkles, Zap } from 'lucide-react'

import type { ReleaseNoteApp, ReleaseNoteCategory } from '../model/types'

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

export const RELEASE_NOTE_CATEGORIES = Object.keys(
  RELEASE_NOTE_CATEGORY_LABELS
) as ReleaseNoteCategory[]

// Which part of ONECore a note concerns.
export const RELEASE_NOTE_APP_LABELS: Record<ReleaseNoteApp, string> = {
  general: 'Allmänt',
  'property-tree': 'ONECore-portalen',
  'keys-portal': 'Nyckelportalen',
  'internal-portal': 'Bilplatsportalen',
  'mina-sidor': 'Mina sidor',
  'sok-ledigt': 'Sök ledigt',
  odoo: 'Odoo',
  core: 'Core',
  leasing: 'Uthyrning',
  property: 'Fastighetsdata',
  'work-order': 'Ärenden',
  keys: 'Nycklar',
  communication: 'Kommunikation',
  contacts: 'Kontakter',
  inspection: 'Besiktning',
  economy: 'Ekonomi',
}

// Grouping for the admin form's select. Every app must be in one group.
export const RELEASE_NOTE_APP_GROUPS: {
  label: string
  apps: ReleaseNoteApp[]
}[] = [
  { label: 'Allmänt', apps: ['general'] },
  {
    label: 'Appar',
    apps: [
      'property-tree',
      'keys-portal',
      'internal-portal',
      'mina-sidor',
      'sok-ledigt',
      'odoo',
    ],
  },
  {
    label: 'Tjänster',
    apps: [
      'core',
      'leasing',
      'property',
      'work-order',
      'keys',
      'communication',
      'contacts',
      'inspection',
      'economy',
    ],
  },
]
