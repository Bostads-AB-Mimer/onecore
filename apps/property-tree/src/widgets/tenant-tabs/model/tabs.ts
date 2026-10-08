import type { SegmentedTab } from '@onecore/ui'
import {
  FileText,
  Home,
  Key,
  Mail,
  MessageSquare,
  Receipt,
  StickyNote,
  Users,
} from 'lucide-react'

export const TENANT_TABS = [
  { value: 'hyreskontrakt', label: 'Hyreskontrakt', icon: FileText },
  { value: 'uthyrning', label: 'Uthyrning', icon: Home },
  { value: 'arenden', label: 'Ärenden', icon: MessageSquare },
  { value: 'fakturor', label: 'Fakturor & betalningar', icon: Receipt },
  { value: 'noteringar', label: 'Noteringar', icon: StickyNote },
  { value: 'kommunikation', label: 'Kommunikationslogg', icon: Mail },
  { value: 'nyckellan', label: 'Nyckellån', icon: Key },
  { value: 'kontakter', label: 'Relaterade kontakter', icon: Users },
] as const satisfies readonly SegmentedTab[]

export type TenantTab = (typeof TENANT_TABS)[number]['value']

export const TENANT_DEFAULT_TAB: TenantTab = 'hyreskontrakt'
