import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPaletteProvider } from './components/hooks/useCommandPalette'
import { AuthCallback } from './auth/AuthCallback'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6'

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
import RentalBlocksPage from './components/rental-blocks/RentalBlocksPage'
import LeasesPage from './components/leases/LeasesPage'
import EconomyPage from './components/economy/EconomyPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

const router = createBrowserRouter([
  {
    path: '/callback',
    element: <AuthCallback />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardView />,
        handle: { title: 'Startsida' },
      },
      {
        path: 'sv',
        element: <DashboardView />,
        handle: { title: 'Startsida' },
      },
      {
        path: 'companies/:companyId',
        element: <CompanyView />,
        handle: { title: 'Företag' },
      },
      {
        path: 'properties',
        element: <SearchView />,
        handle: { title: 'Fastigheter' },
      },
      {
        path: 'properties/:propertyId',
        element: <PropertyView />,
        handle: { title: 'Fastighet' },
      },
      {
        path: 'buildings/:buildingId',
        element: <BuildingView />,
        handle: { title: 'Byggnad' },
      },
      {
        path: 'components',
        element: <ComponentLibraryView />,
        handle: { title: 'Komponenter' },
      },
      {
        path: 'staircases/:buildingId/:staircaseId',
        element: <StaircaseView />,
        handle: { title: 'Uppgång' },
      },
      {
        path: 'residences/:residenceId',
        element: <ResidenceView />,
        handle: { title: 'Bostad' },
      },
      {
        path: 'residences/:residenceId/rooms/:roomId',
        element: <RoomView />,
        handle: { title: 'Rum' },
      },
      {
        path: 'parking-spaces/:rentalId',
        element: <ParkingSpaceView />,
        handle: { title: 'Bilplats' },
      },
      {
        path: 'maintenance-units/:code',
        element: <MaintenanceUnitView />,
        handle: { title: 'Underhållsenhet' },
      },
      {
        path: 'facilities/:rentalId',
        element: <FacilityView />,
        handle: { title: 'Lokal' },
      },
      {
        path: 'tenants',
        element: <AllTenantsPage />,
        handle: { title: 'Kunder' },
      },
      {
        path: 'tenants/:contactCode',
        element: <TenantView />,
        handle: { title: 'Kund' },
      },
      {
        path: 'rental-blocks',
        element: <RentalBlocksPage />,
        handle: { title: 'Spärrar' },
      },
      {
        path: 'leases',
        element: <LeasesPage />,
        handle: { title: 'Hyreskontrakt' },
      },
      {
        path: 'economy',
        element: <EconomyPage />,
        handle: { title: 'Hyreskontrakt' },
      },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CommandPaletteProvider>
        <NuqsAdapter>
          <RouterProvider router={router} />
        </NuqsAdapter>
      </CommandPaletteProvider>
    </QueryClientProvider>
  )
}
