import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { CommandPalette } from './components/CommandPalette'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPaletteProvider } from './components/hooks/useCommandPalette'

import { CompanyView } from './components/views/CompanyView'
import { PropertyView } from './components/views/PropertyView'
import { BuildingView } from './components/views/BuildingView'
import { StaircaseView } from './components/views/StaircaseView'
import { ResidenceView } from './components/views/ResidenceView'
import { TenantView } from './components/views/TenantView'
import { RoomView } from './components/views/RoomView'
import SidebarNavigation from './components/navigation/SidebarNavigation'
import Page from './app/dashboard/page'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from './components/ui/sidebar'
import { Separator } from '@radix-ui/react-separator'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbItem,
  BreadcrumbLink,
} from './components/ui/breadcrumb'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function AppContent() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-gray-900">
      <SidebarProvider>
        <CommandPalette />
        <SidebarNavigation />
        <SidebarInset>
          <header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Hem</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Företag</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Fastighet</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Byggnad</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Våning</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/companies" replace />} />
              <Route path="/page" element={<Page />} />
              <Route path="/companies/:companyId" element={<CompanyView />} />
              <Route path="/properties" element={<PropertyView />} />
              <Route
                path="/properties/:propertyId"
                element={<PropertyView />}
              />
              <Route path="/buildings/:buildingId" element={<BuildingView />} />
              <Route
                path="/staircases/:buildingId/:staircaseId"
                element={<StaircaseView />}
              />
              <Route
                path="/residences/:residenceId"
                element={<ResidenceView />}
              />
              <Route
                path="/residences/:residenceId/rooms/:roomId"
                element={<RoomView />}
              />
              <Route path="/tenants/:tenantId" element={<TenantView />} />
            </Routes>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <CommandPaletteProvider>
          <AppContent />
        </CommandPaletteProvider>
      </Router>
    </QueryClientProvider>
  )
}
