import type { SegmentedTab } from '@onecore/ui'

export const STAIRCASE_TABS = [
  { value: 'bostader', label: 'Bostäder' },
  { value: 'arenden', label: 'Ärenden' },
] as const satisfies readonly SegmentedTab[]

export type StaircaseTab = (typeof STAIRCASE_TABS)[number]['value']

export const STAIRCASE_DEFAULT_TAB: StaircaseTab = 'bostader'
