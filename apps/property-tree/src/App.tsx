import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPaletteProvider } from './components/hooks/useCommandPalette'
import { AuthCallback } from './auth/AuthCallback'

import { CompanyView } from './components/views/CompanyView'
import { PropertyView } from './components/views/PropertyView'
import { BuildingView } from './components/views/BuildingView'
import { StaircaseView } from './components/views/StaircaseView'
import { ResidenceView } from './components/views/ResidenceView'
import { TenantView } from './components/views/TenantView'
import { RoomView } from './components/views/RoomView'
import Page from './app/dashboard/Page'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CommandPaletteProvider>
        <Router>
          <Routes>
            <Route path="/callback" element={<AuthCallback />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/companies" replace />} />
              <Route path="page" element={<Page />} />
              <Route path="companies/:companyId" element={<CompanyView />} />
              <Route path="properties" element={<PropertyView />} />
              <Route path="properties/:propertyId" element={<PropertyView />} />
              <Route path="buildings/:buildingId" element={<BuildingView />} />
              <Route
                path="staircases/:buildingId/:staircaseId"
                element={<StaircaseView />}
              />
              <Route
                path="residences/:residenceId"
                element={<ResidenceView />}
              />
              <Route
                path="residences/:residenceId/rooms/:roomId"
                element={<RoomView />}
              />
              <Route path="tenants/:tenantId" element={<TenantView />} />
            </Route>
          </Routes>
        </Router>
      </CommandPaletteProvider>
    </QueryClientProvider>
  )
}
