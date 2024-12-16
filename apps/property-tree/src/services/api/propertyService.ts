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

  // Get navigation tree with lazy loading
  async getNavigationTree(expandedIds: string[] = []): Promise<NavigationItem[]> {
    try {
      // First get companies
      const companies = await fetchApi<{content: any[]}>('/companies')
      
      // Map companies to navigation items and immediately load their properties
      const navigationItems: NavigationItem[] = await Promise.all(
        companies.content.map(async company => {
          const properties = await fetchApi<{content: any[]}>(`/companies/${company.id}/properties`)
          return {
            id: company.id,
            name: company.name,
            type: 'company' as const,
            children: properties.content.map(property => ({
              id: property.id,
              name: property.propertyDesignation?.name || property.code,
              type: 'property' as const,
              children: [],
              _links: property._links
            })),
            _links: company._links
          }
        })
      )

      // For each expanded ID, fetch its children
      for (const expandedId of expandedIds) {
        // Find the item in the tree
        const findAndPopulateItem = async (items: NavigationItem[]): Promise<boolean> => {
          for (let item of items) {
            if (item.id === expandedId) {
              // If item has no children yet but has links, fetch them
              if (item._links && (!item.children || item.children.length === 0)) {
                try {
                  switch (item.type) {
                    case 'company': {
                      const properties = await fetchApi<{content: Property[]}>(item._links.properties.href)
                      item.children = properties.content.map(property => ({
                        id: property.id,
                        name: property.propertyDesignation.name || property.code,
                        type: 'property' as const,
                        children: [],
                        _links: property._links
                      }))
                      break
                    }
                    case 'property': {
                      const buildings = await fetchApi<{content: Building[]}>(item._links.buildings.href)
                      item.children = buildings.content.map(building => ({
                        id: building.id,
                        name: building.name,
                        type: 'building' as const,
                        children: [],
                        _links: building._links
                      }))
                      break
                    }
                    case 'building': {
                      const staircases = await fetchApi<{content: Staircase[]}>(item._links.staircases.href)
                      item.children = staircases.content.map(staircase => ({
                        id: staircase.id,
                        name: staircase.name || staircase.code,
                        type: 'staircase' as const,
                        children: [],
                        _links: staircase._links
                      }))
                      break
                    }
                    case 'staircase': {
                      const residences = await fetchApi<{content: Residence[]}>(item._links.residences.href)
                      item.children = residences.content.map(residence => ({
                        id: residence.id,
                        name: residence.name || residence.code,
                        type: 'residence' as const
                      }))
                      break
                    }
                  }
                } catch (error) {
                  console.error(`Failed to load children for ${item.type} ${item.id}:`, error)
                }
              }
              return true
            }
            if (item.children && item.children.length > 0) {
              if (await findAndPopulateItem(item.children)) {
                return true
              }
            }
          }
          return false
        }

        await findAndPopulateItem(navigationItems)
      }

      return navigationItems
    } catch (error) {
      console.error('Failed to load navigation tree:', error)
      return []
    }
  },
}
