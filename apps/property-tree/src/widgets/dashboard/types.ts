import type { LucideIcon } from 'lucide-react'

export interface DashboardCard {
  id: string
  title: string
  icon: LucideIcon
  description: string
  path: string
  /** Opens in a new tab instead of navigating inside this app. */
  isExternal: boolean
  /** An external link to another OneCore frontend, not a third-party system. */
  isOnecoreApp?: boolean
  isDisabled: boolean
}
