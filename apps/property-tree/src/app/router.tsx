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

import { routes } from '@/shared/routes'

import { AppLayout } from './layouts/AppLayout'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ProtectedRoute } from './ProtectedRoute'

export const router: RouterProviderProps['router'] = createBrowserRouter([
  {
    path: routes.callback,
    element: <AuthCallback />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: routes.dashboard,
            element: <DashboardPage />,
            handle: { title: 'Startsida' },
          },
          {
            path: '/sv', // alias for dashboard
            element: <DashboardPage />,
            handle: { title: 'Startsida' },
          },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          {
            path: routes.company,
            element: <CompanyPage />,
            handle: { title: 'Företag' },
          },
          {
            path: routes.properties,
            element: <SearchPage />,
            handle: { title: 'Fastigheter' },
          },
          {
            path: routes.property,
            element: <PropertyPage />,
            handle: { title: 'Fastighet' },
          },
          {
            path: routes.building,
            element: <BuildingView />,
            handle: { title: 'Byggnad' },
          },
          {
            path: routes.components,
            element: <ComponentLibraryPage />,
            handle: { title: 'Komponenter' },
          },
          {
            path: routes.staircase,
            element: <StaircasePage />,
            handle: { title: 'Uppgång' },
          },
          {
            path: routes.residence,
            element: <ResidencePage />,
            handle: { title: 'Bostad' },
          },
          {
            path: routes.room,
            element: <RoomPage />,
            handle: { title: 'Rum' },
          },
          {
            path: routes.parkingSpace,
            element: <ParkingSpacePage />,
            handle: { title: 'Bilplats' },
          },
          {
            path: routes.maintenanceUnit,
            element: <MaintenanceUnitPage />,
            handle: { title: 'Underhållsenhet' },
          },
          {
            path: routes.facility,
            element: <FacilityPage />,
            handle: { title: 'Lokal' },
          },
          {
            path: routes.tenants,
            element: <TenantsPage />,
            handle: { title: 'Kunder' },
          },
          {
            path: routes.tenant,
            element: <TenantPage />,
            handle: { title: 'Kund' },
          },
          {
            path: routes.rentalBlocks,
            element: <RentalBlocksPage />,
            handle: { title: 'Spärrar' },
          },
          {
            path: routes.leases,
            element: <LeasesPage />,
            handle: { title: 'Hyreskontrakt' },
          },
          {
            path: routes.inspections,
            element: <InspectionsView />,
            handle: { title: 'Besiktningar' },
          },
        ],
      },
    ],
  },
])
