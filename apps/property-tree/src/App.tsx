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
import SearchView from './components/views/SearchView'
import PropertyView from './components/views/v2/PropertyView'
import BuildingView from './components/views/v2/BuildingView'
import ComponentLibraryView from './components/views/ComponentLibraryView'
import TenantView from './components/views/v2/TenantView'
import { StaircaseView } from './components/views/StaircaseView'
import ResidenceView from './components/views/v2/ResidenceView'
import { RoomView } from './components/views/RoomView'
import { ParkingSpaceView } from './components/views/ParkingSpaceView'
import { MaintenanceUnitView } from './components/views/MaintenanceUnitView'
import { FacilityView } from './components/views/FacilityView'
import { DashboardView } from './components/views/DashboardView'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import AllTenantsPage from './components/tenants/AllTenantsPage'
import BarriersPage from './components/barriers/BarriersPage'

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
              <Route index element={<DashboardView />} />
              {/* Legacy route ----------------------------*/}
              <Route path="sv" element={<DashboardView />} />
              {/*------------------------------------------*/}
              <Route path="companies/:companyId" element={<CompanyView />} />
              <Route path="properties" element={<SearchView />} />
              <Route path="properties/:propertyId" element={<PropertyView />} />
              <Route path="buildings/:buildingId" element={<BuildingView />} />
              <Route path="components" element={<ComponentLibraryView />} />
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
              <Route
                path="parking-spaces/:rentalId"
                element={<ParkingSpaceView />}
              />
              <Route
                path="maintenance-units/:code"
                element={<MaintenanceUnitView />}
              />
              <Route path="facilities/:rentalId" element={<FacilityView />} />
              <Route path="tenants" element={<AllTenantsPage />} />
              <Route path="tenants/:contactCode" element={<TenantView />} />
              <Route path="barriers" element={<BarriersPage />} />
            </Route>
          </Routes>
        </Router>
      </CommandPaletteProvider>
    </QueryClientProvider>
  )
}
