import { Outlet } from 'react-router-dom'
import { CommandPalette } from '../CommandPalette'
import SidebarNavigation from '../navigation/SidebarNavigation'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../ui/Sidebar'

import { NavigationBar } from '../NavigationBar'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-secondary">
      {/* Header */}
      <NavigationBar
        onMenuClick={() => console.log('todo: handle menu click')}
      />
      <div className="flex h-[calc(100vh-3.5rem)] mt-14 relative">
        <SidebarProvider>
          <CommandPalette />
          <SidebarNavigation />
          <SidebarInset>
            {/* Main content */}
            <main className="flex-1">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}
