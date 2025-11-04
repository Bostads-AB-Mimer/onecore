import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppSidebar } from '@/components/Navigation'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import Keys from './pages/Keys'
import KeySystems from './pages/KeySystems'
import KeySystemDetail from './pages/KeySystemDetail'
import KeyBundles from './pages/KeyBundles'
import NotFound from './pages/NotFound'
import { AuthCallback } from './auth/AuthCallback'
import { ProtectedRoute } from './auth/ProtectedRoute'
import KeyLoan from './pages/KeyLoan'
import ActivityLog from './pages/ActivityLog'
import MaintenanceKeys from './pages/MaintenanceKeys'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

const AppContent = () => (
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/KeyLoan" replace />} />
          <Route path="/Keys" element={<Keys />} />
          <Route path="/key-systems" element={<KeySystems />} />
          <Route path="/key-systems/:id" element={<KeySystemDetail />} />
          <Route path="/key-bundles" element={<KeyBundles />} />
          <Route path="/KeyLoan" element={<KeyLoan />} />
          <Route path="/maintenance-keys" element={<MaintenanceKeys />} />
          <Route path="/activity-log" element={<ActivityLog />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </SidebarInset>
  </SidebarProvider>
)

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/callback" element={<AuthCallback />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
