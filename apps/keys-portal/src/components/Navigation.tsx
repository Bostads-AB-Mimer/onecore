import * as React from 'react'
import {
  ChevronRight,
  Key,
  Lock,
  KeyRound,
  ScrollText,
  Wrench,
  Layers,
} from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'

export function Navigation({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <h1 className="text-lg font-bold px-2">Nyckelportalen</h1>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Utlåning */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/KeyLoan'}
                >
                  <Link to="/KeyLoan">
                    <KeyRound className="h-4 w-4" />
                    <span>Utlåning</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Entreprenör with nested Nyckelsamlingar */}
              <Collapsible
                defaultOpen={
                  location.pathname === '/maintenance-keys' ||
                  location.pathname === '/key-bundles'
                }
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/maintenance-keys'}
                  >
                    <CollapsibleTrigger asChild>
                      <Link to="/maintenance-keys" className="w-full">
                        <Wrench className="h-4 w-4" />
                        <span>Entreprenör</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </Link>
                    </CollapsibleTrigger>
                  </SidebarMenuButton>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.pathname === '/key-bundles'}
                        >
                          <Link to="/key-bundles">
                            <Layers className="h-4 w-4" />
                            <span>Nyckelsamlingar</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Nycklar */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/Keys'}
                >
                  <Link to="/Keys">
                    <Key className="h-4 w-4" />
                    <span>Nycklar</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Låssystem */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/key-systems'}
                >
                  <Link to="/key-systems">
                    <Lock className="h-4 w-4" />
                    <span>Låssystem</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Händelselogg */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/activity-log'}
                >
                  <Link to="/activity-log">
                    <ScrollText className="h-4 w-4" />
                    <span>Händelselogg</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
