import React from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@radix-ui/react-collapsible'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  LayoutGrid,
  Contact,
  ShieldX,
  FileText,
  ChevronRight,
  Settings,
} from 'lucide-react'
import { CompanyList } from './CompanyList'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/Sidebar'
import { useHierarchicalSelection } from '@/components/hooks/useHierarchicalSelection'
import {
  CompanyExpansionProvider,
  useCompanyExpansion,
} from './CompanyExpansionContext'

export default function SidebarNavigation() {
  return (
    <CompanyExpansionProvider>
      <SidebarNavigationContent />
    </CompanyExpansionProvider>
  )
}

function SidebarNavigationContent() {
  const location = useLocation()
  const { selectionState } = useHierarchicalSelection()
  const { requestExpansion } = useCompanyExpansion()

  // Two independent state variables for managing collapsible sections
  const [isFastighetsdataExpanded, setIsFastighetsdataExpanded] =
    React.useState(true)
  const [isForetagExpanded, setIsForetagExpanded] = React.useState(false)

  // Route detection for active states
  const isHomeActive = location.pathname === '/' || location.pathname === '/sv'
  const isPropertiesActive = location.pathname === '/properties'
  const isTenantsActive = location.pathname === '/tenants'
  const isRentalBlocksActive = location.pathname === '/rental-blocks'
  const isLeasesActive = location.pathname === '/leases'
  const isComponentsActive = location.pathname === '/components'

  // Auto-expand logic
  const shouldAutoExpandFastighetsdata =
    selectionState.selectedCompanyId !== null ||
    selectionState.selectedPropertyId !== null

  // Auto-expand Fastighetsdata when hierarchy is selected
  React.useEffect(() => {
    if (shouldAutoExpandFastighetsdata) {
      setIsFastighetsdataExpanded(true)
    }
  }, [shouldAutoExpandFastighetsdata])

  // Auto-expand Företag when company is selected
  React.useEffect(() => {
    if (selectionState.selectedCompanyId !== null) {
      setIsForetagExpanded(true)
    }
  }, [selectionState.selectedCompanyId])

  const handleFastighetsdataClick = () => {
    setIsFastighetsdataExpanded(true)
    setIsForetagExpanded(true)

    // Request expansion of company 001 (BOSTADS AB MIMER)
    requestExpansion('001')
  }

  return (
    <Sidebar>
      <SidebarContent className="gap-0">
        {/* STARTSIDA - Home navigation item */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isHomeActive}
                tooltip="Startsida"
              >
                <Link to="/">
                  <Home />
                  <span>Startsida</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* FASTIGHETSDATA - Parent collapsible section */}
        <Collapsible
          open={isFastighetsdataExpanded}
          onOpenChange={setIsFastighetsdataExpanded}
          className="group/collapsible"
        >
          <SidebarGroup>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  asChild
                  isActive={isPropertiesActive}
                  tooltip="Fastighetsdata"
                >
                  <Link to="/properties" onClick={handleFastighetsdataClick}>
                    <LayoutGrid />
                    <span>Fastighetsdata</span>
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </Link>
                </SidebarMenuButton>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <SidebarGroupContent>
                  {/* FÖRETAG - Nested collapsible section */}
                  <Collapsible
                    open={isForetagExpanded}
                    onOpenChange={setIsForetagExpanded}
                    className="group/nested-collapsible ml-4"
                  >
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <ChevronRight className="transition-transform group-data-[state=open]/nested-collapsible:rotate-90" />
                        <span>Företag</span>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          <CompanyList />
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </Collapsible>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarMenuItem>
          </SidebarGroup>
        </Collapsible>

        {/* KUNDER - Simple navigation item */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isTenantsActive}
                tooltip="Kunder"
              >
                <Link to="/tenants">
                  <Contact />
                  <span>Kunder</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* SPÄRRAR - Simple navigation item */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isRentalBlocksActive}
                tooltip="Spärrar"
              >
                <Link to="/rental-blocks">
                  <ShieldX />
                  <span>Spärrar</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* HYRESKONTRAKT - Simple navigation item */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isLeasesActive}
                tooltip="Hyreskontrakt"
              >
                <Link to="/leases">
                  <FileText />
                  <span>Hyreskontrakt</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* ADMINISTRERA KOMPONENTER - Simple navigation item */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isComponentsActive}
                tooltip="Administrera Komponenter"
              >
                <Link to="/components">
                  <Settings />
                  <span>Administrera Komponenter</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
