import type { SegmentedTab } from '@onecore/ui'
import {
  ClipboardList,
  FileText,
  MessageSquare,
  Receipt,
  Users,
} from 'lucide-react'

export const PARKING_SPACE_TABS = [
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

export type ParkingSpaceTab = (typeof PARKING_SPACE_TABS)[number]['value']

export const PARKING_SPACE_DEFAULT_TAB: ParkingSpaceTab = 'hyresgast'
