import { createBrowserRouter, type RouterProviderProps } from 'react-router-dom'

import BuildingView from '@/pages/BuildingPage'
import { CompanyPage } from '@/pages/CompanyPage'
import ComponentLibraryPage from '@/pages/ComponentLibraryPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { FacilityPage } from '@/pages/FacilityPage'
import InspectionsView from '@/pages/InspectionsPage'
import LeasesPage from '@/pages/LeasesPage'
import { MaintenanceUnitPage } from '@/pages/MaintenanceUnitPage'
import { ParkingSpacePage } from '@/pages/ParkingSpacePage'
import { PropertyPage } from '@/pages/PropertyPage'
import { RentalBlocksPage } from '@/pages/RentalBlocksPage'
import { ResidencePage } from '@/pages/ResidencePage'
import { RoomPage } from '@/pages/RoomPage'
import { SearchPage } from '@/pages/SearchPage'
import { StaircasePage } from '@/pages/StaircasePage'
import { TenantPage } from '@/pages/TenantPage'
import { TenantsPage } from '@/pages/TenantsPage'

import { AuthCallback } from '@/features/auth'

import { AppLayout } from './layouts/AppLayout'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ProtectedRoute } from './ProtectedRoute'

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
            element: <DashboardPage />,
            handle: { title: 'Startsida' },
          },
          {
            path: '/sv',
            element: <DashboardPage />,
            handle: { title: 'Startsida' },
          },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          {
            path: 'companies/:companyId',
            element: <CompanyPage />,
            handle: { title: 'Företag' },
          },
          {
            path: 'properties',
            element: <SearchPage />,
            handle: { title: 'Fastigheter' },
          },
          {
            path: 'properties/:propertyId',
            element: <PropertyPage />,
            handle: { title: 'Fastighet' },
          },
          {
            path: 'buildings/:buildingId',
            element: <BuildingView />,
            handle: { title: 'Byggnad' },
          },
          {
            path: 'components',
            element: <ComponentLibraryPage />,
            handle: { title: 'Komponenter' },
          },
          {
            path: 'staircases/:buildingId/:staircaseId',
            element: <StaircasePage />,
            handle: { title: 'Uppgång' },
          },
          {
            path: 'residences/:residenceId',
            element: <ResidencePage />,
            handle: { title: 'Bostad' },
          },
          {
            path: 'residences/:residenceId/rooms/:roomId',
            element: <RoomPage />,
            handle: { title: 'Rum' },
          },
          {
            path: 'parking-spaces/:rentalId',
            element: <ParkingSpacePage />,
            handle: { title: 'Bilplats' },
          },
          {
            path: 'maintenance-units/:code',
            element: <MaintenanceUnitPage />,
            handle: { title: 'Underhållsenhet' },
          },
          {
            path: 'facilities/:rentalId',
            element: <FacilityPage />,
            handle: { title: 'Lokal' },
          },
          {
            path: 'tenants',
            element: <TenantsPage />,
            handle: { title: 'Kunder' },
          },
          {
            path: 'tenants/:contactCode',
            element: <TenantPage />,
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
            path: 'inspections',
            element: <InspectionsView />,
            handle: { title: 'Besiktningar' },
          },
        ],
      },
    ],
  },
])
