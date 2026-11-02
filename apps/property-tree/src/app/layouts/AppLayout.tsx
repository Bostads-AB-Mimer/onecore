import { Outlet } from 'react-router-dom'

import { GuideSheet } from '@/widgets/guide-sheet'
import { SidebarNavigation } from '@/widgets/sidebar'

import { CommandPalette } from '@/features/search'

import { FeedbackModalProvider } from '@/shared/hooks/useFeedbackModal'
import { GuideSheetProvider } from '@/shared/hooks/useGuideSheet'
import { SidebarToggleButton } from '@/shared/ui/layout'
import { SidebarInset, SidebarProvider, useSidebar } from '@/shared/ui/Sidebar'
import { Toaster } from '@/shared/ui/Toaster'

import { FeedbackModal } from '@/components/feedback/FeedbackModal'

import { AppHeader } from './AppHeader'
import { RouteDocumentTitle } from './RouteDocumentTitle'

/**
 * Full application shell with sidebar, navigation bar, and command palette.
 * Used for all authenticated pages except the dashboard.
 */
export function AppLayout() {
  return (
    <FeedbackModalProvider>
      <GuideSheetProvider>
        <SidebarProvider>
          <AppLayoutContent />
        </SidebarProvider>
      </GuideSheetProvider>
    </FeedbackModalProvider>
  )
}

function AppLayoutContent() {
  const { toggleSidebar } = useSidebar()

  return (
    <div className="flex-1 min-w-0 min-h-screen bg-gradient-to-b from-white to-secondary">
      <RouteDocumentTitle />
      <a
        href="#huvudinnehall"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Hoppa till innehållet
      </a>
      <AppHeader onMenuClick={toggleSidebar} />
      <div className="flex h-[calc(100vh-3.5rem)] mt-14 relative w-full overflow-x-hidden">
        <CommandPalette />
        <SidebarNavigation />
        <SidebarToggleButton />
        <SidebarInset>
          <div id="huvudinnehall" tabIndex={-1} className="w-full outline-none">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
      <Toaster />
      <FeedbackModal />
      <GuideSheet />
    </div>
  )
}
