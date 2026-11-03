import { Link, useLocation } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/Sidebar'

interface SidebarNavLinkProps {
  to: string
  icon: LucideIcon
  label: string
  /** Also highlight on sub-routes, e.g. /guider/:slug under /guider. */
  matchPrefix?: boolean
}

export function SidebarNavLink({
  to,
  icon: Icon,
  label,
  matchPrefix = false,
}: SidebarNavLinkProps) {
  const { pathname } = useLocation()
  const isActive =
    pathname === to ||
    (to === '/' && pathname === '/sv') ||
    (matchPrefix && pathname.startsWith(`${to}/`))

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
            <Link to={to}>
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
