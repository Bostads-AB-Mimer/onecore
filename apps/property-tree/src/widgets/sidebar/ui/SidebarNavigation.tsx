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
import { SidebarNavLink } from '@/shared/ui/layout'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/shared/ui/Sidebar'
import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'
import {
  CompanyExpansionProvider,
  useCompanyExpansion,
} from './CompanyExpansionContext'

export function SidebarNavigation() {
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

  const isPropertiesActive = location.pathname === '/properties'

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
        <SidebarNavLink to="/" icon={Home} label="Startsida" />

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

        <SidebarNavLink to="/tenants" icon={Contact} label="Kunder" />
        <SidebarNavLink to="/rental-blocks" icon={ShieldX} label="Spärrar" />
        <SidebarNavLink to="/leases" icon={FileText} label="Hyreskontrakt" />
        <SidebarNavLink
          to="/components"
          icon={Settings}
          label="Administrera Komponenter"
        />
      </SidebarContent>
    </Sidebar>
  )
}
