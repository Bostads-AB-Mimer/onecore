import { Outlet } from 'react-router-dom'
import { CommandPalette } from '@/features/search'
import { SidebarInset, SidebarProvider, useSidebar } from '@/shared/ui/Sidebar'
import { Toaster } from '@/shared/ui/Toaster'
import { AppHeader } from './AppHeader'
import { RouteDocumentTitle } from './RouteDocumentTitle'

import { SidebarNavigation } from '@/widgets/sidebar'
import { SidebarToggleButton } from '@/shared/ui/layout'

/**
 * Full application shell with sidebar, navigation bar, and command palette.
 * Used for all authenticated pages except the dashboard.
 */
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
      <RouteDocumentTitle />
      <AppHeader onMenuClick={toggleSidebar} />
      <div className="flex h-[calc(100vh-3.5rem)] mt-14 relative w-full overflow-x-hidden">
        <CommandPalette />
        <SidebarNavigation />
        <SidebarToggleButton />
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
