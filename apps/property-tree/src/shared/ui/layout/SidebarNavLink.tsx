import { Link, useLocation } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/shared/ui/Sidebar'

interface SidebarNavLinkProps {
  to: string
  icon: LucideIcon
  label: string
}

export function SidebarNavLink({ to, icon: Icon, label }: SidebarNavLinkProps) {
  const { pathname } = useLocation()
  const isActive = pathname === to || (to === '/' && pathname === '/sv')

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
