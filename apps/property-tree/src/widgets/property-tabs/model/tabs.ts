import type { SegmentedTab } from '@onecore/ui'

export const PROPERTY_TABS = [
  { value: 'sammanstallning', label: 'Fastighetssammanställning' },
  { value: 'dokument', label: 'Dokument' },
  { value: 'byggnader', label: 'Byggnader' },
  { value: 'underhallsenheter', label: 'Underhållsenheter' },
  { value: 'arenden', label: 'Ärenden' },
] as const satisfies readonly SegmentedTab[]

export type PropertyTab = (typeof PROPERTY_TABS)[number]['value']

export const PROPERTY_DEFAULT_TAB: PropertyTab = 'sammanstallning'
