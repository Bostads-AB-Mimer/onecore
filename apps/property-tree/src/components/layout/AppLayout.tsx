import { Outlet, useLocation } from 'react-router-dom'
import { CommandPalette } from '../CommandPalette'
import SidebarNavigation from '../navigation/SidebarNavigation'
import { SidebarInset, SidebarProvider, useSidebar } from '../ui/Sidebar'
import { Toaster } from '../ui/Toaster'

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
  const location = useLocation()

  // Hide topbar + sidebar on dashboard view
  const isDashboard = location.pathname === '/' || location.pathname === '/sv'

  return (
    <div className="flex-1 min-h-screen bg-gradient-to-b from-white to-secondary w-screen max-w-full overflow-x-hidden">
      {/* Header */}
      {!isDashboard && <NavigationBar onMenuClick={toggleSidebar} />}
      <div
        className={`flex h-[calc(100vh-3.5rem)] mt-${isDashboard ? '0' : '14'} relative w-full overflow-x-hidden`}
      >
        <CommandPalette />
        {!isDashboard && <SidebarNavigation />}
        <SidebarInset>
          <div className="w-full">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
      <Toaster />
    </div>
  )
}
