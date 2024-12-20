import React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarProvider,
} from '../ui/sidebar'
import { NavigationProvider } from '@/contexts/NavigationContext'
import { CompanyList } from './CompanyList'

export default function SidebarNavigation() {
  return (
    <NavigationProvider>
      <SidebarProvider defaultOpen className="flex-shrink-0">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <CompanyList />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </NavigationProvider>
  )
}
