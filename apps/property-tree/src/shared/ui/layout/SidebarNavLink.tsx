import { Link, useLocation } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'

import { isPathWithin } from '@/shared/routes'
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
}

export function SidebarNavLink({ to, icon: Icon, label }: SidebarNavLinkProps) {
  const { pathname } = useLocation()
  const isActive =
    to === '/'
      ? pathname === '/' || pathname === '/sv'
      : isPathWithin(pathname, to)

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
