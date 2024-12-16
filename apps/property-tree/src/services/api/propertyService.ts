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
  async getNavigationTree(): Promise<NavigationItem[]> {
    try {
      // First get companies
      const companies = await fetchApi<{content: any[]}>('/companies')
      
      const navigationItems: NavigationItem[] = []
      
      for (const company of companies.content) {
        try {
          // Get properties for each company using HATEOAS link
          const properties = await fetchApi<{content: Property[]}>(company._links.properties.href)
          
          const propertyItems = []
          
          for (const property of properties.content) {
            try {
              // Get buildings using HATEOAS link from property
              const buildings = await fetchApi<{content: Building[]}>(property._links.buildings.href)
              
              const buildingItems = []
              
              for (const building of buildings.content) {
                try {
                  // Get staircases using HATEOAS link from building
                  const staircases = await fetchApi<{content: Staircase[]}>(building._links.staircases.href)
                  
                  const staircaseItems = []
                  
                  for (const staircase of staircases.content) {
                    try {
                      // Get residences using HATEOAS link from staircase
                      const residences = await fetchApi<{content: Residence[]}>(staircase._links.residences.href)
                      
                      staircaseItems.push({
                        id: staircase.id,
                        name: staircase.name || staircase.code,
                        type: 'staircase' as const,
                        children: residences.content.map(residence => ({
                          id: residence.id,
                          name: residence.name || residence.code,
                          type: 'residence' as const,
                        }))
                      })
                    } catch (error) {
                      console.error(`Failed to load residences for staircase ${staircase.id}:`, error)
                      staircaseItems.push({
                        id: staircase.id,
                        name: staircase.name || staircase.code,
                        type: 'staircase' as const,
                        children: []
                      })
                    }
                  }

                  buildingItems.push({
                    id: building.id,
                    name: building.name,
                    type: 'building' as const,
                    children: staircaseItems
                  })
                } catch (error) {
                  console.error(`Failed to load staircases for building ${building.id}:`, error)
                  buildingItems.push({
                    id: building.id,
                    name: building.name,
                    type: 'building' as const,
                    children: []
                  })
                }
              }

              propertyItems.push({
                id: property.id,
                name: property.propertyDesignation.name || property.code,
                type: 'property' as const,
                children: buildingItems
              })
            } catch (error) {
              console.error(`Failed to load buildings for property ${property.id}:`, error)
              propertyItems.push({
                id: property.id,
                name: property.propertyDesignation.name || property.code,
                type: 'property' as const,
                children: []
              })
            }
          }

          navigationItems.push({
            id: company.id,
            name: company.name,
            type: 'company' as const,
            children: propertyItems
          })
        } catch (error) {
          console.error(`Failed to load properties for company ${company.id}:`, error)
          navigationItems.push({
            id: company.id,
            name: company.name,
            type: 'company' as const,
            children: []
          })
        }
      }

      return navigationItems
    } catch (error) {
      console.error('Failed to load navigation tree:', error)
      return [] // Return empty array instead of failing completely
    }
  },
}
