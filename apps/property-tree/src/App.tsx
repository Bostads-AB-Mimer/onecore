import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Settings, User2 } from 'lucide-react'
import { CommandPalette } from './components/CommandPalette'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  CommandPaletteProvider,
  useCommandPalette,
} from './components/hooks/useCommandPalette'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

import { CompanyView } from './components/views/CompanyView'
import { PropertyView } from './components/views/PropertyView'
import { BuildingView } from './components/views/BuildingView'
import { StaircaseView } from './components/views/StaircaseView'
import { ResidenceView } from './components/views/ResidenceView'
import { TenantView } from './components/views/TenantView'
import { RoomView } from './components/views/RoomView'
import SidebarNavigation from './components/navigation/SidebarNavigation'
import { NavigationProvider } from '@/contexts/NavigationContext'
import Page from './app/dashboard/page'

function AppContent() {
  const { open: openCommandPalette } = useCommandPalette()

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-gray-900">
      <CommandPalette />
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-14 border-b bg-white dark:bg-gray-900 dark:border-gray-800 z-40">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold">O</span>
              </div>
              <span className="font-semibold">OneCore</span>
            </motion.div>
          </div>

          <div className="flex-1 max-w-xl px-4">
            <button
              onClick={openCommandPalette}
              className="w-full flex items-center h-9 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <Search className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left">Sök i OneCore...</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
            >
              <Settings className="h-5 w-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
            >
              <User2 className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
      </nav>
      hej hejf
      <NavigationProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Navigation Overview</BreadcrumbPage>
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
                <Route path="/properties/:propertyId" element={<PropertyView />} />
                <Route path="/buildings/:buildingId" element={<BuildingView />} />
                <Route
                  path="/staircases/:staircaseId"
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
      </NavigationProvider>
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
