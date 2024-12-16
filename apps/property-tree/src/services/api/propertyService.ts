import { Building, NavigationItem, Property, Staircase } from '../types'
import { fetchApi } from './baseApi'
import { Cache } from '../../utils/cache'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const propertiesCache = new Cache<Property[]>(CACHE_TTL)

// Types based on API schema
// Types based on API responses
interface PropertyListResponse {
  content: Property[]
}

interface PropertyDetailsResponse {
  content: PropertyDetails
}

interface StaircaseListResponse {
  content: Staircase[]
}

interface BuildingListResponse {
  content: Building[]
}

interface BuildingDetailsResponse {
  content: Building
}

export const propertyService = {
  // Get all properties with optional tract filter
  async getAll(companyCode: string, tract?: string): Promise<Property[]> {
    const properties = await propertiesCache.get(async () => {
      const url = new URL('/properties', API_BASE_URL)
      url.searchParams.append('companyCode', companyCode)
      if (tract) {
        url.searchParams.append('tract', tract)
      }
      const response = await fetchApi<PropertyListResponse>(url.toString())
      return response.content
    })
    return properties
  },

  // Get unique areas (tracts) from all properties
  async getAreas(): Promise<string[]> {
    const properties = await this.getAll()
    const uniqueAreas = new Set(properties.map((p) => p.tract).filter(Boolean))
    return Array.from(uniqueAreas).sort()
  },

  // Get property by ID
  async getById(id: string): Promise<PropertyDetails> {
    const response = await fetchApi<PropertyDetailsResponse>(
      `/properties/${id}`
    )
    return response.content
  },

  // Get all buildings for a property
  async getBuildingsByPropertyCode(propertyCode: string): Promise<Building[]> {
    const response = await fetchApi<Building[]>(`/buildings/${propertyCode}/`)
    return response
  },

  // Get building by building code
  async getBuildingByCode(buildingCode: string): Promise<Building> {
    const response = await fetchApi<Building>(
      `/buildings/buildingCode/${buildingCode}/`
    )
    return response
  },

  // Get staircases for a building
  async getStaircasesByBuildingCode(
    buildingCode: string
  ): Promise<Staircase[]> {
    const response = await fetchApi<StaircaseResponse>(
      `/staircases/${buildingCode}/`
    )
    return response.content
  },

  // Get navigation tree
  async getNavigationTree(expandedIds: string[] = []): Promise<NavigationItem[]> {
    try {
      // First get companies
      const companies = await fetchApi<{content: any[]}>('/companies')
      
      const navigationItems: NavigationItem[] = []
      
      for (const company of companies.content) {
        const companyItem: NavigationItem = {
          id: company.id,
          name: company.name,
          type: 'company' as const,
          children: []
        }

        // Only fetch children if company is expanded
        if (expandedIds.includes(company.id)) {
          try {
            const properties = await fetchApi<{content: Property[]}>(company._links.properties.href)
            
            for (const property of properties.content) {
              const propertyItem: NavigationItem = {
                id: property.id,
                name: property.propertyDesignation.name || property.code,
                type: 'property' as const,
                children: []
              }

              // Only fetch buildings if property is expanded
              if (expandedIds.includes(property.id)) {
                try {
                  const buildings = await fetchApi<{content: Building[]}>(property._links.buildings.href)
                  
                  for (const building of buildings.content) {
                    const buildingItem: NavigationItem = {
                      id: building.id,
                      name: building.name,
                      type: 'building' as const,
                      children: []
                    }

                    // Only fetch staircases if building is expanded
                    if (expandedIds.includes(building.id)) {
                      try {
                        const staircases = await fetchApi<{content: Staircase[]}>(building._links.staircases.href)
                        
                        for (const staircase of staircases.content) {
                          const staircaseItem: NavigationItem = {
                            id: staircase.id,
                            name: staircase.name || staircase.code,
                            type: 'staircase' as const,
                            children: []
                          }

                          // Only fetch residences if staircase is expanded
                          if (expandedIds.includes(staircase.id)) {
                            try {
                              const residences = await fetchApi<{content: Residence[]}>(staircase._links.residences.href)
                              staircaseItem.children = residences.content.map(residence => ({
                                id: residence.id,
                                name: residence.name || residence.code,
                                type: 'residence' as const,
                              }))
                            } catch (error) {
                              console.error(`Failed to load residences for staircase ${staircase.id}:`, error)
                            }
                          }
                          buildingItem.children.push(staircaseItem)
                        }
                      } catch (error) {
                        console.error(`Failed to load staircases for building ${building.id}:`, error)
                      }
                    }
                    propertyItem.children.push(buildingItem)
                  }
                } catch (error) {
                  console.error(`Failed to load buildings for property ${property.id}:`, error)
                }
              }
              companyItem.children.push(propertyItem)
            }
          } catch (error) {
            console.error(`Failed to load properties for company ${company.id}:`, error)
          }
        }
        navigationItems.push(companyItem)
      }

      return navigationItems
    } catch (error) {
      console.error('Failed to load navigation tree:', error)
      return [] // Return empty array instead of failing completely
    }
  },
}
