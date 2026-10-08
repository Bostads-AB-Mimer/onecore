import { createBrowserRouter, type RouterProviderProps } from 'react-router-dom'
import { leasingRoutes } from '@onecore/leasing-portal-frontend'

import BuildingView from '@/pages/BuildingPage'
import { CompanyPage } from '@/pages/CompanyPage'
import ComponentLibraryPage from '@/pages/ComponentLibraryPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { EconomyPage } from '@/pages/EconomyPage'
import { FacilityPage } from '@/pages/FacilityPage'
import { ImdPage } from '@/pages/ImdPage'
import InspectionsView from '@/pages/InspectionsPage'
import LeasesPage from '@/pages/LeasesPage'
import { LeasingPortalPage } from '@/pages/LeasingPortalPage'
import { MaintenanceUnitPage } from '@/pages/MaintenanceUnitPage'
import { ParkingSpacePage } from '@/pages/ParkingSpacePage'
import { PropertyAreasPage } from '@/pages/PropertyAreasPage'
import { PropertyPage } from '@/pages/PropertyPage'
import { RentalBlocksPage } from '@/pages/RentalBlocksPage'
import { ResidencePage } from '@/pages/ResidencePage'
import { RoomPage } from '@/pages/RoomPage'
import { SearchPage } from '@/pages/SearchPage'
import { StaircasePage } from '@/pages/StaircasePage'
import { TenantPage } from '@/pages/TenantPage'
import { TenantsPage } from '@/pages/TenantsPage'

import { AuthCallback } from '@/features/auth'

import { routes, withTab } from '@/shared/routes'

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
            path: withTab(routes.property),
            element: <PropertyPage />,
            handle: { title: 'Fastighet' },
          },
          {
            path: routes.propertyAreas,
            element: <PropertyAreasPage />,
            handle: { title: 'Förvaltningsområden' },
          },
          {
            path: withTab(routes.building),
            element: <BuildingView />,
            handle: { title: 'Byggnad' },
          },
          {
            path: routes.components,
            element: <ComponentLibraryPage />,
            handle: { title: 'Komponenter' },
          },
          {
            path: withTab(routes.staircase),
            element: <StaircasePage />,
            handle: { title: 'Uppgång' },
          },
          {
            path: withTab(routes.residence),
            element: <ResidencePage />,
            handle: { title: 'Bostad' },
          },
          {
            path: routes.room,
            element: <RoomPage />,
            handle: { title: 'Rum' },
          },
          {
            path: withTab(routes.parkingSpace),
            element: <ParkingSpacePage />,
            handle: { title: 'Bilplats' },
          },
          {
            path: withTab(routes.maintenanceUnit),
            element: <MaintenanceUnitPage />,
            handle: { title: 'Underhållsenhet' },
          },
          {
            path: withTab(routes.facility),
            element: <FacilityPage />,
            handle: { title: 'Lokal' },
          },
          {
            path: routes.tenants,
            element: <TenantsPage />,
            handle: { title: 'Kunder' },
          },
          {
            path: withTab(routes.tenant),
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
            path: 'economy',
            element: <EconomyPage />,
            handle: { title: 'Ekonomi' },
          },
          {
            path: routes.imd,
            element: <ImdPage />,
            handle: { title: 'IMD' },
          },
          {
            path: withTab(routes.inspections),
            element: <InspectionsView />,
            handle: { title: 'Besiktningar' },
          },
          {
            path: routes.leasing,
            element: <LeasingPortalPage />,
            handle: { title: 'Uthyrning' },
            children: leasingRoutes,
          },
        ],
      },
    ],
  },
])
