import type { SegmentedTab } from '@onecore/ui'
import {
  ClipboardList,
  FileText,
  Info,
  MessageSquare,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react'

export const FACILITY_TABS = [
  { value: 'komponenter', label: 'Komponenter', icon: Wrench },
  { value: 'rum', label: 'Rumsinformation', icon: Info },
  { value: 'hyresgast', label: 'Hyresgäst', icon: Users },
  { value: 'kontrakt', label: 'Kontrakt', icon: FileText },
  { value: 'hyresrader', label: 'Hyresrader', icon: Receipt },
  {
    value: 'besiktningar',
    label: 'Besiktningar',
    icon: ClipboardList,
    disabled: true,
  },
  { value: 'arenden', label: 'Ärenden', icon: MessageSquare },
] as const satisfies readonly SegmentedTab[]

export type FacilityTab = (typeof FACILITY_TABS)[number]['value']

export const FACILITY_DEFAULT_TAB: FacilityTab = 'komponenter'
