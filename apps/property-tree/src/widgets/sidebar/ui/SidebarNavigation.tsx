import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@radix-ui/react-collapsible'
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  Contact,
  FileText,
  Gauge,
  Home,
  LayoutGrid,
  LayoutTemplate,
  ListOrdered,
  Receipt,
  Send,
  Settings,
  ShieldX,
} from 'lucide-react'

import { modules } from '@/shared/config/modules'
import { routes } from '@/shared/routes'
import { SidebarNavLink } from '@/shared/ui/layout'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/Sidebar'

import { useHierarchicalSelection } from '../hooks/useHierarchicalSelection'
import {
  CompanyExpansionProvider,
  useCompanyExpansion,
} from './CompanyExpansionContext'
import { CompanyList } from './CompanyList'
import { ModuleNavigation } from './ModuleNavigation'

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

  const isPropertiesActive = location.pathname === routes.properties

  // Utskick group: open while on either of its pages, collapsible otherwise.
  const isOnUtskickPage =
    location.pathname === routes.dispatchCentre ||
    location.pathname === routes.messageTemplates
  const [isUtskickExpanded, setIsUtskickExpanded] =
    React.useState(isOnUtskickPage)
  React.useEffect(() => {
    if (isOnUtskickPage) setIsUtskickExpanded(true)
  }, [isOnUtskickPage])

  // Auto-expand logic
  const shouldAutoExpandFastighetsdata =
    selectionState.selectedOrganizationNumber !== null ||
    selectionState.selectedPropertyCode !== null

  // Auto-expand Fastighetsdata when hierarchy is selected
  React.useEffect(() => {
    if (shouldAutoExpandFastighetsdata) {
      setIsFastighetsdataExpanded(true)
    }
  }, [shouldAutoExpandFastighetsdata])

  // Auto-expand Företag when any entity in the hierarchy is selected
  React.useEffect(() => {
    if (selectionState.selectedOrganizationNumber !== null) {
      setIsForetagExpanded(true)
    }
  }, [selectionState.selectedOrganizationNumber])

  const handleFastighetsdataClick = () => {
    setIsFastighetsdataExpanded(true)
    setIsForetagExpanded(true)

    // Request expansion of company 001 (BOSTADS AB MIMER)
    requestExpansion('001')
  }

  return (
    <Sidebar>
      <SidebarContent className="gap-0">
        <SidebarNavLink to={routes.dashboard} icon={Home} label="Startsida" />

        {/* FASTIGHETSDATA - Parent collapsible section */}
        <Collapsible
          open={isFastighetsdataExpanded}
          onOpenChange={setIsFastighetsdataExpanded}
          className="group/collapsible"
        >
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    asChild
                    isActive={isPropertiesActive}
                    tooltip="Fastighetsdata"
                  >
                    <Link
                      to={routes.properties}
                      onClick={handleFastighetsdataClick}
                    >
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
            </SidebarMenu>
          </SidebarGroup>
        </Collapsible>

        <SidebarNavLink to={routes.tenants} icon={Contact} label="Kunder" />
        <SidebarNavLink
          to={routes.rentalBlocks}
          icon={ShieldX}
          label="Spärrar"
        />
        <SidebarNavLink
          to={routes.leases}
          icon={FileText}
          label="Hyreskontrakt"
        />
        {modules.map((module) => (
          <ModuleNavigation key={module.id} module={module} />
        ))}
        {/* UTSKICK - collapsible with Mallar nested under it */}
        <Collapsible
          open={isUtskickExpanded}
          onOpenChange={setIsUtskickExpanded}
          className="group/utskick-collapsible"
        >
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === routes.dispatchCentre}
                    tooltip="Utskick"
                  >
                    <Link to={routes.dispatchCentre}>
                      <Send />
                      <span>Utskick</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/utskick-collapsible:rotate-90" />
                    </Link>
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent className="ml-4">
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={
                            location.pathname === routes.messageTemplates
                          }
                          tooltip="Mallar"
                        >
                          <Link to={routes.messageTemplates}>
                            <LayoutTemplate />
                            <span>Mallar</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </Collapsible>
        <SidebarNavLink
          to={routes.inspections}
          icon={ClipboardList}
          label="Besiktningar"
        />
        <SidebarNavLink to={routes.imd} icon={Gauge} label="IMD" />
        <SidebarNavLink
          to={routes.economy}
          icon={Receipt}
          label="Skapa ströfaktura"
        />
        <SidebarNavLink
          to={routes.miscellaneousInvoices}
          icon={ListOrdered}
          label="Ströfakturor"
        />
        <SidebarNavLink
          to={routes.components}
          icon={Settings}
          label="Administrera Komponenter"
        />
        <SidebarNavLink to={routes.guides} icon={BookOpen} label="Guider" />
        {/* Temporarily hidden from the nav while the feature is finalized.
            The route still works, so the page is reachable via /forvaltningsomraden. */}
        {/* <SidebarNavLink
          to={routes.propertyAreas}
          icon={LayoutGrid}
          label="Förvaltningsområden"
        /> */}
      </SidebarContent>
    </Sidebar>
  )
}
