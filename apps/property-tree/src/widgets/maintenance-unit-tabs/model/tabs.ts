import type { SegmentedTab } from '@onecore/ui'
import { ClipboardList, MessageSquare, Wrench } from 'lucide-react'

export const MAINTENANCE_UNIT_TABS = [
  { value: 'komponenter', label: 'Komponenter', icon: Wrench },
  {
    value: 'besiktningar',
    label: 'Besiktningar',
    icon: ClipboardList,
    disabled: true,
  },
  { value: 'arenden', label: 'Ärenden', icon: MessageSquare },
] as const satisfies readonly SegmentedTab[]

export type MaintenanceUnitTab = (typeof MAINTENANCE_UNIT_TABS)[number]['value']

export const MAINTENANCE_UNIT_DEFAULT_TAB: MaintenanceUnitTab = 'arenden'
