import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchApi } from '../services/api/baseApi'
import {
  Building2,
  ChevronRight,
  MapPin,
  Home,
  Layers,
  Building,
  DoorClosed,
  Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import { NavigationItem } from '../services/types'
import { propertyService } from '../services/api'

const iconMap = {
  area: MapPin,
  property: Building2,
  building: Building,
  staircase: Layers,
  residence: Home,
  default: DoorClosed,
}

const routeMap = {
  area: '/areas',
  property: '/properties',
  building: '/buildings',
  staircase: '/staircases',
  residence: '/residences',
  tenant: '/tenants',
}

interface NavigationItemProps {
  item: NavigationItem
  level: number
  expanded: Record<string, boolean>
  selected: string | null
  onToggle: (id: string) => void
  onSelect: (item: NavigationItem) => void
}

const NavigationItemComponent: React.FC<NavigationItemProps> = ({
  item,
  level,
  expanded,
  selected,
  onToggle,
  onSelect,
}) => {
  const Icon = iconMap[item.type] || iconMap.default
  const hasChildren = item.children && item.children.length > 0
  const hasSingleChild = hasChildren && item.children?.length === 1
  const isExpanded = expanded[item.id] || hasSingleChild
  const isSelected = selected === item.id
  const navigate = useNavigate()

  // Auto-expand if this is the only child at this level
  React.useEffect(() => {
    if (hasSingleChild) {
      switch (item.type) {
        case 'company':
          handleCompanyToggle(item.id)
          break
        case 'property':
          handlePropertyToggle(item.id)
          break
        case 'building':
          handleBuildingToggle(item.id)
          break
        case 'staircase':
          handleStaircaseToggle(item.id)
          break
      }
    }
  }, [])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()

    // Always toggle expansion for companies
    if (item.type === 'company') {
      handleCompanyToggle(item.id)
    }
    // For other items with children, only toggle if not single child
    else if (hasChildren && !hasSingleChild) {
      if (item.type === 'property') {
        handlePropertyToggle(item.id)
      } else if (item.type === 'building') {
        handleBuildingToggle(item.id)
      } else if (item.type === 'staircase') {
        handleStaircaseToggle(item.id)
      }
    }

    onSelect(item)

    // Navigate if it's not a company
    if (item.type !== 'company') {
      const basePath = routeMap[item.type]
      if (basePath) {
        navigate(`${basePath}/${item.id}`)
      }
    }
  }

  return (
    <>
      <SidebarMenuButton
        onClick={handleClick}
        isActive={isSelected}
        className={cn('cursor-pointer w-full')}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
      >
        <div className="flex items-center space-x-2 flex-1">
          <Icon
            className={clsx(
              'h-4 w-4 transition-colors duration-300',
              isSelected
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
            )}
          />
          <span className="truncate">
            {item.name.replace('** TEST **', '')}
          </span>
        </div>
        {hasChildren && !hasSingleChild && (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.div>
        )}

        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-50/0 to-blue-50/0 dark:via-blue-900/0 dark:to-blue-900/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          layoutId={`hover-${item.id}`}
        />
      </SidebarMenuButton>

      <AnimatePresence>
        {isExpanded && item.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {item.children.map((child) => (
              <NavigationItemComponent
                key={child.id}
                item={child}
                level={level + 1}
                expanded={expanded}
                selected={selected}
                onToggle={
                  item.type === 'company'
                    ? handleCompanyToggle
                    : item.type === 'property'
                    ? handlePropertyToggle
                    : item.type === 'building'
                    ? handleBuildingToggle
                    : handleStaircaseToggle
                }
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

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
import { cn } from '@/utils/cn'

export function PropertyNavigation() {
  interface NavigationState {
    companies: Map<string, Company>
    properties: Map<string, Property>
    buildings: Map<string, Building>
    staircases: Map<string, Staircase>
    residences: Map<string, Residence>
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

  const handleToggle = (id: string, type: string) => {
    switch (type) {
      case 'company':
        handleCompanyToggle(id)
        break
      case 'property':
        handlePropertyToggle(id)
        break
      case 'building':
        handleBuildingToggle(id)
        break
      case 'staircase':
        handleStaircaseToggle(id)
        break
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
                      <NavigationItemComponent
                        item={{
                          id: company.id,
                          name: company.name,
                          type: 'company',
                          _links: company._links,
                          hasChildren: true,
                        }}
                        level={0}
                        expanded={expanded}
                        selected={selected}
                        onToggle={handleCompanyToggle}
                        onSelect={handleSelect}
                      >
                        {expanded[company.id] &&
                          Array.from(navigationState.properties.values())
                            .filter(
                              (property) =>
                                property.links.company === company.id
                            )
                            .map((property) => (
                              <SidebarMenuItem key={property.id}>
                                <NavigationItemComponent
                                  item={{
                                    id: property.id,
                                    name:
                                      property.propertyDesignation?.name ||
                                      property.code,
                                    type: 'property',
                                    _links: property._links,
                                    hasChildren: true,
                                  }}
                                  level={1}
                                  expanded={expanded}
                                  selected={selected}
                                  onToggle={handleToggle}
                                  onSelect={handleSelect}
                                >
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
                                          <NavigationItemComponent
                                            item={{
                                              id: building.id,
                                              name:
                                                building.name || building.code,
                                              type: 'building',
                                              _links: building._links,
                                              hasChildren: true,
                                            }}
                                            level={2}
                                            expanded={expanded}
                                            selected={selected}
                                            onToggle={handleToggle}
                                            onSelect={handleSelect}
                                          >
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
                                                    <NavigationItemComponent
                                                      item={{
                                                        id: staircase.id,
                                                        name:
                                                          staircase.name ||
                                                          staircase.code,
                                                        type: 'staircase',
                                                        _links:
                                                          staircase._links,
                                                        hasChildren: true,
                                                      }}
                                                      level={3}
                                                      expanded={expanded}
                                                      selected={selected}
                                                      onToggle={handleToggle}
                                                      onSelect={handleSelect}
                                                    >
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
                                                              <NavigationItemComponent
                                                                item={{
                                                                  id: residence.id,
                                                                  name:
                                                                    residence.name ||
                                                                    residence.code,
                                                                  type: 'residence',
                                                                  _links:
                                                                    residence._links,
                                                                  hasChildren:
                                                                    false,
                                                                }}
                                                                level={4}
                                                                expanded={
                                                                  expanded
                                                                }
                                                                selected={
                                                                  selected
                                                                }
                                                                onToggle={
                                                                  handleToggle
                                                                }
                                                                onSelect={
                                                                  handleSelect
                                                                }
                                                              />
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
