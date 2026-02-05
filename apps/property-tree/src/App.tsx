import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPaletteProvider } from '@/hooks/useCommandPalette'
import { AuthCallback } from './auth/AuthCallback'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6'

import { CompanyView } from './views/CompanyView'
import SearchView from './views/SearchView'
import PropertyView from './views/PropertyView'
import BuildingView from './views/BuildingView'
import ComponentLibraryView from './views/ComponentLibraryView'
import TenantView from './views/TenantView'
import { StaircaseView } from './views/StaircaseView'
import ResidenceView from './views/ResidenceView'
import { RoomView } from './views/RoomView'
import { ParkingSpaceView } from './views/ParkingSpaceView'
import { MaintenanceUnitView } from './views/MaintenanceUnitView'
import { FacilityView } from './views/FacilityView'
import { DashboardView } from './views/DashboardView'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import TenantsView from './views/TenantsView'
import InspectionsView from './views/InspectionsView'
import RentalBlocksView from './views/RentalBlocksView'
import LeasesView from './views/LeasesView'

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
        element: <TenantsView />,
        handle: { title: 'Kunder' },
      },
      {
        path: 'tenants/:contactCode',
        element: <TenantView />,
        handle: { title: 'Kund' },
      },
      {
        path: 'rental-blocks',
        element: <RentalBlocksView />,
        handle: { title: 'Spärrar' },
      },
      {
        path: 'leases',
        element: <LeasesView />,
        handle: { title: 'Hyreskontrakt' },
      },
      {
        path: 'inspections',
        element: <InspectionsView />,
        handle: { title: 'Besiktningar' },
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
