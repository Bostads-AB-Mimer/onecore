import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Navigation } from '@/components/Navigation'
import Keys from './pages/Keys'
import KeySystems from './pages/KeySystems'
import KeySystemDetail from './pages/KeySystemDetail'
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
  <>
    <Navigation />
    <Routes>
      <Route path="/" element={<Navigate to="/KeyLoan" replace />} />
      <Route path="/Keys" element={<Keys />} />
      <Route path="/key-systems" element={<KeySystems />} />
      <Route path="/key-systems/:id" element={<KeySystemDetail />} />
      <Route path="/KeyLoan" element={<KeyLoan />} />
      <Route path="/maintenance-keys" element={<MaintenanceKeys />} />
      <Route path="/activity-log" element={<ActivityLog />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
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
