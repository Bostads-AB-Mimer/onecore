import { Outlet } from 'react-router-dom'

import { SidebarNavigation } from '@/widgets/sidebar'

import { CommandPalette } from '@/features/search'

import { FeedbackModalProvider } from '@/shared/hooks/useFeedbackModal'
import { FeedbackModal } from '@/components/feedback/FeedbackModal'
import { SidebarToggleButton } from '@/shared/ui/layout'
import { SidebarInset, SidebarProvider, useSidebar } from '@/shared/ui/Sidebar'
import { Toaster } from '@/shared/ui/Toaster'

import { AppHeader } from './AppHeader'
import { RouteDocumentTitle } from './RouteDocumentTitle'

/**
 * Layout for the dashboard — includes header and sidebar.
 */
export function DashboardLayout() {
  return (
    <FeedbackModalProvider>
      <SidebarProvider>
        <DashboardLayoutContent />
      </SidebarProvider>
    </FeedbackModalProvider>
  )
}

function DashboardLayoutContent() {
  const { toggleSidebar } = useSidebar()

  return (
    <div className="flex-1 min-h-screen bg-gradient-to-b from-white to-secondary">
      <RouteDocumentTitle />
      <AppHeader onMenuClick={toggleSidebar} hideMobileSearch />
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
      <FeedbackModal />
    </div>
  )
}
