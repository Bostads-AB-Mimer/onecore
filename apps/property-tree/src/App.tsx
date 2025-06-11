import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { CommandPalette } from './components/CommandPalette'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPaletteProvider } from './components/hooks/useCommandPalette'
import {
  AuthProvider,
  ProtectedRoute,
  useAuth,
} from './components/auth/useAuth'
import { AuthCallback } from './components/auth/AuthCallback'

import { CompanyView } from './components/views/CompanyView'
import { PropertyView } from './components/views/PropertyView'
import { BuildingView } from './components/views/BuildingView'
import { StaircaseView } from './components/views/StaircaseView'
import { ResidenceView } from './components/views/ResidenceView'
import { TenantView } from './components/views/TenantView'
import { RoomView } from './components/views/RoomView'
import SidebarNavigation from './components/navigation/SidebarNavigation'
import Page from './app/dashboard/Page'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from './components/ui/Sidebar'
import { Separator } from '@radix-ui/react-separator'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
} from './components/ui/Breadcrumb'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function AppContent() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-gray-900">
      <SidebarProvider>
        <CommandPalette />
        <SidebarNavigation />
        <SidebarInset>
          <header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="flex justify-between w-full">
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
              {user && (
                <div className="flex items-center gap-4">
                  <span className="text-sm">{user.name}</span>
                  <button
                    onClick={logout}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Logga ut
                  </button>
                </div>
              )}
            </div>
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
  const authConfig = {
    keycloakUrl:
      import.meta.env.VITE_KEYCLOAK_URL ||
      'https://auth-test.mimer.nu/realms/onecore-test',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'onecore-test',
    apiUrl: import.meta.env.VITE_CORE_API_URL || 'http://localhost:5010',
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider config={authConfig}>
        <Router>
          <CommandPaletteProvider>
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
          </CommandPaletteProvider>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}
