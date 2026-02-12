import { createBrowserRouter, type RouterProviderProps } from 'react-router-dom'
import { AuthCallback } from '@/features/auth'

import { CompanyView } from '@/views/CompanyView'
import SearchView from '@/views/SearchView'
import PropertyView from '@/views/PropertyView'
import BuildingView from '@/views/BuildingView'
import ComponentLibraryView from '@/views/ComponentLibraryView'
import TenantView from '@/views/TenantView'
import { StaircaseView } from '@/views/StaircaseView'
import ResidenceView from '@/views/ResidenceView'
import { RoomView } from '@/views/RoomView'
import { ParkingSpaceView } from '@/views/ParkingSpaceView'
import { MaintenanceUnitView } from '@/views/MaintenanceUnitView'
import { FacilityView } from '@/views/FacilityView'
import { DashboardView } from '@/views/DashboardView'
import TenantsView from '@/views/TenantsView'
import InspectionsView from '@/views/InspectionsView'
import RentalBlocksView from '@/views/RentalBlocksView'
import LeasesView from '@/views/LeasesView'

import { ProtectedRoute } from './ProtectedRoute'
import { AppLayout } from './layouts/AppLayout'
import { DashboardLayout } from './layouts/DashboardLayout'

export const router: RouterProviderProps['router'] = createBrowserRouter([
  {
    path: '/callback',
    element: <AuthCallback />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: '/',
            element: <DashboardView />,
            handle: { title: 'Startsida' },
          },
          {
            path: '/sv',
            element: <DashboardView />,
            handle: { title: 'Startsida' },
          },
        ],
      },
      {
        element: <AppLayout />,
        children: [
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
    ],
  },
])
