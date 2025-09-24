import { Outlet } from 'react-router-dom'
import { CommandPalette } from '../CommandPalette'
import SidebarNavigation from '../navigation/SidebarNavigation'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../ui/Sidebar'
import { Separator } from '@radix-ui/react-separator'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
} from '../ui/Breadcrumb'
import { useAuth } from '../../auth/useAuth'
import { useUser } from '../../auth/useUser'

export function AppLayout() {
  const { logout } = useAuth()
  const userState = useUser()

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
              {userState.tag === 'success' && (
                <div className="flex items-center gap-4">
                  <span className="text-sm">{userState.user.name}</span>
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
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}