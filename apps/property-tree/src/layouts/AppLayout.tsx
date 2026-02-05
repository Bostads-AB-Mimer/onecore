import { Outlet, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CommandPalette } from '../components/CommandPalette'
import SidebarNavigation from '../components/navigation/SidebarNavigation'
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '../components/ui/Sidebar'
import { Toaster } from '../components/ui/Toaster'
import { PageTitle } from './PageTitle'

import { NavigationBar } from '../components/navigation/NavigationBar'

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppLayoutContent />
    </SidebarProvider>
  )
}
//TODO better design for toggle button
function SidebarToggleButton() {
  const { toggleSidebar, open } = useSidebar()

  return (
    <button
      onClick={toggleSidebar}
      className="fixed top-[4.25rem] z-20 hidden md:flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-all duration-200"
      style={{
        left: open ? 'calc(var(--sidebar-width) - 0.75rem)' : '0.25rem',
      }}
      aria-label="Toggle Sidebar"
    >
      {open ? (
        <ChevronLeft className="h-3 w-3" />
      ) : (
        <ChevronRight className="h-3 w-3" />
      )}
    </button>
  )
}

function AppLayoutContent() {
  const { toggleSidebar } = useSidebar()
  const location = useLocation()

  // Hide topbar + sidebar on dashboard view
  const isDashboard = location.pathname === '/' || location.pathname === '/sv'

  return (
    <div className="flex-1 min-h-screen bg-gradient-to-b from-white to-secondary">
      <PageTitle />
      {/* Header */}
      {!isDashboard && <NavigationBar onMenuClick={toggleSidebar} />}
      <div
        className={`flex h-[calc(100vh-3.5rem)] mt-${isDashboard ? '0' : '14'} relative w-full overflow-x-hidden`}
      >
        <CommandPalette />
        {!isDashboard && (
          <>
            <SidebarNavigation />
            <SidebarToggleButton />
          </>
        )}
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
