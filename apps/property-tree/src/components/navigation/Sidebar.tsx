import React from 'react'
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarProvider,
} from '../ui/sidebar'
import { CompanyNavigation } from './CompanyNavigation'

export function Sidebar() {
  return (
    <SidebarProvider>
      <UISidebar className="w-64">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <CompanyNavigation />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </UISidebar>
    </SidebarProvider>
  )
}
