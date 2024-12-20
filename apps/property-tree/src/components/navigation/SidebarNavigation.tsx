import React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarProvider,
} from '../ui/sidebar'
import { ChevronRight } from 'lucide-react'
import { NavigationProvider } from '@/contexts/NavigationContext'
import { CompanyList } from './CompanyList'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'

export default function SidebarNavigation() {
  return (
    <NavigationProvider>
      <SidebarProvider defaultOpen className="flex-shrink-0">
        <Sidebar>
          <SidebarContent>
            <Collapsible
              key="companies"
              title="Companies"
              defaultOpen
              className="group/collapsible"
            >
              <SidebarGroup>
                <CollapsibleTrigger className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                  Companies
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <CompanyList />
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </NavigationProvider>
  )
}
