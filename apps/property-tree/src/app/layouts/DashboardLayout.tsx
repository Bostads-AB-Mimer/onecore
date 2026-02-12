import { Outlet } from 'react-router-dom'
import { CommandPalette } from '@/features/search'
import { Toaster } from '@/shared/ui/Toaster'
import { RouteDocumentTitle } from './RouteDocumentTitle'

/**
 * Minimal layout for the dashboard — no sidebar or navigation bar.
 */
export function DashboardLayout() {
  return (
    <div className="flex-1 min-h-screen bg-gradient-to-b from-white to-secondary">
      <RouteDocumentTitle />
      <div className="flex h-screen relative w-full overflow-x-hidden">
        <CommandPalette />
        <div className="w-full">
          <Outlet />
        </div>
      </div>
      <Toaster />
    </div>
  )
}
