import type { SegmentedTab } from '@onecore/ui'
import {
  ClipboardList,
  FileText,
  Folder,
  Info,
  KeyRound,
  Lock,
  Map,
  MessageSquare,
  Receipt,
  Users,
  Wrench,
} from 'lucide-react'

export const RESIDENCE_TABS = [
  { value: 'rum', label: 'Rumsinformation', icon: Info },
  { value: 'bofaktablad', label: 'Bofaktablad', icon: Map },
  { value: 'besiktningar', label: 'Besiktningar', icon: ClipboardList },
  { value: 'hyresgast', label: 'Hyresgäst', icon: Users },
  { value: 'kontrakt', label: 'Kontrakt', icon: FileText },
  { value: 'hyresrader', label: 'Hyresrader', icon: Receipt },
  { value: 'nycklar', label: 'Nycklar', icon: KeyRound },
  { value: 'arenden', label: 'Ärenden', icon: MessageSquare },
  { value: 'dokument', label: 'Dokument', icon: Folder },
  { value: 'sparrar', label: 'Spärrar', icon: Lock },
  { value: 'underhallsenheter', label: 'Underhållsenheter', icon: Wrench },
] as const satisfies readonly SegmentedTab[]

export type ResidenceTab = (typeof RESIDENCE_TABS)[number]['value']

export const RESIDENCE_DEFAULT_TAB: ResidenceTab = 'rum'
