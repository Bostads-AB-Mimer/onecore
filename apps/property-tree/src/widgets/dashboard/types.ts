import type { LucideIcon } from 'lucide-react'

export interface DashboardCard {
  id: string
  title: string
  icon: LucideIcon
  description: string
  path: string
  isExternal: boolean
  isDisabled: boolean
}
