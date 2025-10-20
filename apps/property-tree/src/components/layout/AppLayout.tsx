import { Outlet } from 'react-router-dom'
import { CommandPalette } from '../CommandPalette'
import SidebarNavigation from '../navigation/SidebarNavigation'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '../ui/Sidebar'

import { NavigationBar } from '../NavigationBar'

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppLayoutContent />
    </SidebarProvider>
  )
}

function AppLayoutContent() {
  const { toggleSidebar } = useSidebar()

  return (
    <div className="flex-1 min-h-screen bg-gradient-to-b from-white to-secondary">
      {/* Header */}
      <NavigationBar onMenuClick={toggleSidebar} />
      <div className="flex h-[calc(100vh-3.5rem)] mt-14 relative">
        <CommandPalette />
        <SidebarNavigation />
        <SidebarInset>
          <div className="w-full">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </div>
  )
}
