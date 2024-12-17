import {
  BuildingWithLinks,
  CompanyWithLinks,
  NavigationItem,
  PropertyWithLinks,
  ResidenceWithLinks,
  StaircaseWithLinks,
} from '@/services/types'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from './ui/sidebar'
import { Building2, Building as BuildingIcon, Home, Hotel, Warehouse } from 'lucide-react'
import { motion } from 'framer-motion'

import {
  Building,
  Property,
  Residence,
  Staircase,
} from '@/services/api/schemas'
import React from 'react'
import { fetchApi } from '@/services/api/baseApi'
import { Loader2 } from 'lucide-react'

export function PropertyNavigation() {
  interface NavigationState {
    companies: Map<string, CompanyWithLinks>
    properties: Map<string, PropertyWithLinks>
    buildings: Map<string, BuildingWithLinks>
    staircases: Map<string, StaircaseWithLinks>
    residences: Map<string, ResidenceWithLinks>
  }

  const [navigationState, setNavigationState] = React.useState<NavigationState>(
    {
      companies: new Map(),
      properties: new Map(),
      buildings: new Map(),
      staircases: new Map(),
      residences: new Map(),
    }
  )
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [selected, setSelected] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const loadNavigation = async () => {
      try {
        // Always load companies first
        const companiesResponse = await fetchApi<{
          content: CompanyWithLinks[]
        }>('/companies')
        const companiesMap = new Map(
          companiesResponse.content.map((company) => [company.id, company])
        )

        // For expanded companies, load their properties
        const expandedCompanies = Object.keys(expanded).filter(
          (id) => expanded[id] && companiesMap.has(id)
        )

        const propertiesMap = new Map()
        const buildingsMap = new Map()
        const staircasesMap = new Map()
        const residencesMap = new Map()

        // Load properties for expanded companies
        for (const companyId of expandedCompanies) {
          const company = companiesMap.get(companyId)
          if (company?._links?.properties) {
            const propertiesResponse = await fetchApi<{
              content: PropertyWithLinks[]
            }>(company._links.properties.href)
            propertiesResponse.content.forEach((property) => {
              propertiesMap.set(property.id, property)
            })
          }
        }

        // Load buildings for expanded properties
        const expandedProperties = Object.keys(expanded).filter(
          (id) => expanded[id] && propertiesMap.has(id)
        )
        for (const propertyId of expandedProperties) {
          const property = propertiesMap.get(propertyId)
          if (property?._links?.buildings) {
            const buildingsResponse = await fetchApi<{ content: Building[] }>(
              property._links.buildings.href
            )
            buildingsResponse.content.forEach((building) => {
              buildingsMap.set(building.id, building)
            })
          }
        }

        // Load staircases for expanded buildings
        const expandedBuildings = Object.keys(expanded).filter(
          (id) => expanded[id] && buildingsMap.has(id)
        )
        for (const buildingId of expandedBuildings) {
          const building = buildingsMap.get(buildingId)
          if (building?._links?.staircases) {
            const staircasesResponse = await fetchApi<{ content: Staircase[] }>(
              building._links.staircases.href
            )
            staircasesResponse.content.forEach((staircase) => {
              staircasesMap.set(staircase.id, staircase)
            })
          }
        }

        // Load residences for expanded staircases
        const expandedStaircases = Object.keys(expanded).filter(
          (id) => expanded[id] && staircasesMap.has(id)
        )
        for (const staircaseId of expandedStaircases) {
          const staircase = staircasesMap.get(staircaseId)
          if (staircase?._links?.residences) {
            const residencesResponse = await fetchApi<{ content: Residence[] }>(
              staircase._links.residences.href
            )
            residencesResponse.content.forEach((residence) => {
              residencesMap.set(residence.id, residence)
            })
          }
        }

        setNavigationState({
          companies: companiesMap,
          properties: propertiesMap,
          buildings: buildingsMap,
          staircases: staircasesMap,
          residences: residencesMap,
        })

        // Auto-expand if there's only one company
        if (companiesMap.size === 1) {
          const [firstCompanyId] = companiesMap.keys()
          setExpanded((prev) => ({
            ...prev,
            [firstCompanyId]: true,
          }))
        }
      } catch (err) {
        setError('Kunde inte ladda navigationsdata')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadNavigation()
  }, [expanded])

  const handleCompanyToggle = (id: string) => {
    const company = navigationState.companies.get(id)
    if (company) {
      setExpanded((prev) => ({
        ...prev,
        [id]: !prev[id],
      }))
    }
  }

  const handlePropertyToggle = (id: string) => {
    const property = navigationState.properties.get(id)
    if (property) {
      setExpanded((prev) => ({
        ...prev,
        [id]: !prev[id],
      }))
    }
  }

  const handleBuildingToggle = (id: string) => {
    const building = navigationState.buildings.get(id)
    if (building) {
      setExpanded((prev) => ({
        ...prev,
        [id]: !prev[id],
      }))
    }
  }

  const handleStaircaseToggle = (id: string) => {
    const staircase = navigationState.staircases.get(id)
    if (staircase) {
      setExpanded((prev) => ({
        ...prev,
        [id]: !prev[id],
      }))
    }
  }

  const handleResidenceToggle = (id: string) => {
    const residence = navigationState.residences.get(id)
    if (residence) {
      setExpanded((prev) => ({
        ...prev,
        [id]: !prev[id],
      }))
    }
  }

  const handleSelect = (item: NavigationItem) => {
    setSelected(item.id)

    if (item.type === 'residence') {
      const path = [] as string[]

      const findPath = (items: NavigationItem[], target: string): boolean => {
        for (const item of items) {
          if (item.id === target) {
            path.push(item.id)
            return true
          }
          if (item.children && findPath(item.children, target)) {
            path.push(item.id)
            return true
          }
        }
        return false
      }

      findPath(navigationItems, item.id)

      setExpanded((prev) => {
        const newExpanded = { ...prev }
        path.forEach((id) => {
          newExpanded[id] = true
        })
        return newExpanded
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-6 w-6 text-blue-500" />
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 text-center">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar className="w-64">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Companies */}
                {Array.from(navigationState.companies.values()).map(
                  (company) => (
                    <SidebarMenuItem key={company.id}>
                      <SidebarMenuButton
                        onClick={() => {
                          handleCompanyToggle(company.id)
                          handleSelect({
                            id: company.id,
                            name: company.name,
                            type: 'company',
                            _links: company._links,
                          })
                        }}
                        isActive={selected === company.id}
                      >
                        <Building2 />
                        <span>{company.name}</span>
                      </SidebarMenuButton>
                        {expanded[company.id] &&
                          Array.from(navigationState.properties.values())
                            .filter(
                              (property) =>
                                property._links.company === company.id
                            )
                            .map((property) => (
                              <SidebarMenuItem key={property.id}>
                                <SidebarMenuButton
                                  onClick={() => {
                                    handlePropertyToggle(property.id)
                                    handleSelect({
                                      id: property.id,
                                      name: property.propertyDesignation?.name || property.code,
                                      type: 'property',
                                      _links: property._links,
                                    })
                                  }}
                                  isActive={selected === property.id}
                                >
                                  <BuildingIcon />
                                  <span>{property.propertyDesignation?.name || property.code}</span>
                                </SidebarMenuButton>
                                  {expanded[property.id] &&
                                    Array.from(
                                      navigationState.buildings.values()
                                    )
                                      .filter(
                                        (building) =>
                                          building.links.property ===
                                          property.id
                                      )
                                      .map((building) => (
                                        <SidebarMenuItem key={building.id}>
                                          <SidebarMenuButton
                                            onClick={() => {
                                              handleBuildingToggle(building.id)
                                              handleSelect({
                                                id: building.id,
                                                name: building.name || building.code,
                                                type: 'building',
                                                _links: building._links,
                                              })
                                            }}
                                            isActive={selected === building.id}
                                          >
                                            <Warehouse />
                                            <span>{building.name || building.code}</span>
                                          </SidebarMenuButton>
                                            {expanded[building.id] &&
                                              Array.from(
                                                navigationState.staircases.values()
                                              )
                                                .filter(
                                                  (staircase) =>
                                                    staircase.links.building ===
                                                    building.id
                                                )
                                                .map((staircase) => (
                                                  <SidebarMenuItem
                                                    key={staircase.id}
                                                  >
                                                    <SidebarMenuButton
                                                      onClick={() => {
                                                        handleStaircaseToggle(staircase.id)
                                                        handleSelect({
                                                          id: staircase.id,
                                                          name: staircase.name || staircase.code,
                                                          type: 'staircase',
                                                          _links: staircase._links,
                                                        })
                                                      }}
                                                      isActive={selected === staircase.id}
                                                    >
                                                      <Home />
                                                      <span>{staircase.name || staircase.code}</span>
                                                    </SidebarMenuButton>
                                                      {expanded[staircase.id] &&
                                                        Array.from(
                                                          navigationState.residences.values()
                                                        )
                                                          .filter(
                                                            (residence) =>
                                                              residence.links
                                                                .staircase ===
                                                              staircase.id
                                                          )
                                                          .map((residence) => (
                                                            <SidebarMenuItem
                                                              key={residence.id}
                                                            >
                                                              <SidebarMenuButton
                                                                onClick={() => {
                                                                  handleResidenceToggle(residence.id)
                                                                  handleSelect({
                                                                    id: residence.id,
                                                                    name: residence.name || residence.code,
                                                                    type: 'residence',
                                                                    _links: residence._links,
                                                                  })
                                                                }}
                                                                isActive={selected === residence.id}
                                                              >
                                                                <Hotel />
                                                                <span>{residence.name || residence.code}</span>
                                                              </SidebarMenuButton>
                                                            </SidebarMenuItem>
                                                          ))}
                                                    </NavigationItemComponent>
                                                  </SidebarMenuItem>
                                                ))}
                                          </NavigationItemComponent>
                                        </SidebarMenuItem>
                                      ))}
                                </NavigationItemComponent>
                              </SidebarMenuItem>
                            ))}
                      </NavigationItemComponent>
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}
