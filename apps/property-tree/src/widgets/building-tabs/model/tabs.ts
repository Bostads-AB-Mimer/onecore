import type { SegmentedTab } from '@onecore/ui'

export const BUILDING_TABS = [
  { value: 'uppgangar', label: 'Uppgångar' },
  { value: 'underhallsenheter', label: 'Underhållsenheter' },
  { value: 'arenden', label: 'Ärenden' },
  { value: 'dokument', label: 'Dokument' },
] as const satisfies readonly SegmentedTab[]

export type BuildingTab = (typeof BUILDING_TABS)[number]['value']

export const BUILDING_DEFAULT_TAB: BuildingTab = 'uppgangar'
