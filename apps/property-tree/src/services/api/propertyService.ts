import {
  Building,
  CompanyWithLinks,
  NavigationItem,
  PropertyWithLinks,
  Staircase,
} from '../types'
import { fetchApi } from './baseApi'
import { Cache } from '../../utils/cache'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const propertiesCache = new Cache<PropertyWithLinks[]>(CACHE_TTL)

interface PropertyListResponse {
  content: PropertyWithLinks[]
}

interface PropertyDetailsResponse {
  content: PropertyWithLinks
}

interface BuildingListResponse {
  content: Building[]
}

interface StaircaseListResponse {
  content: Staircase[]
}

export const propertyService = {
  // Get all properties using HATEOAS link
  async getAll(company: CompanyWithLinks): Promise<PropertyWithLinks[]> {
    const properties = await propertiesCache.get(async () => {
      const response = await fetchApi<PropertyListResponse>(
        company._links.properties.href
      )
      return response.content
    })
    return properties
  },

  // Get property by using HATEOAS self link
  async getProperty(property: PropertyWithLinks): Promise<PropertyWithLinks> {
    const response = await fetchApi<PropertyDetailsResponse>(
      property._links.self.href
    )
    return response.content
  },

  // Get buildings for a property using HATEOAS link
  async getPropertyBuildings(property: PropertyWithLinks) {
    return fetchApi<BuildingListResponse>(property._links.buildings.href)
  },

  // Get residences for a property using HATEOAS link
  async getPropertyResidences(property: PropertyWithLinks) {
    return fetchApi<BuildingListResponse>(property._links.residences.href)
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

  // Get navigation tree with lazy loading
  async getNavigationTree(
    expandedIds: string[] = []
  ): Promise<NavigationItem[]> {
    try {
      // First get companies
      const companies = await fetchApi<{ content: CompanyWithLinks[] }>(
        '/companies'
      )

      // Map companies to navigation items and immediately load their properties
      const navigationItems: NavigationItem[] = await Promise.all(
        companies.content.map(async (company) => {
          const properties = await fetchApi<PropertyListResponse>(
            company._links.properties.href
          )
          return {
            type: 'company' as const,
            children: await Promise.all(
              properties.content.map(async (property) => {
                return {
                  name: property.propertyDesignation?.name || property.code,
                  type: 'property' as const,
                  children: [],
                  ...property, // Ensure all property details are included
                }
              })
            ),
            ...company, // Ensure all company details are included
          }
        })
      )

      // For each expanded ID, fetch its children
      for (const expandedId of expandedIds) {
        // Find the item in the tree
        const findAndPopulateItem = async (
          items: NavigationItem[]
        ): Promise<boolean> => {
          for (const item of items) {
            if (item.id === expandedId) {
              // If item has no children yet but has links, fetch them
              if (
                item._links &&
                (!item.children || item.children.length === 0)
              ) {
                try {
                  switch (item.type) {
                    case 'company': {
                      const properties = await fetchApi<PropertyListResponse>(
                        item._links.properties.href
                      )
                      item.children = properties.content.map((property) => ({
                        id: property.id,
                        name:
                          property.propertyDesignation.name || property.code,
                        type: 'property' as const,
                        children: [],
                        _links: property._links,
                      }))
                      break
                    }
                    case 'property': {
                      const buildings = await fetchApi<BuildingListResponse>(
                        item._links.buildings.href
                      )
                      item.children = buildings.content.map((building) => ({
                        id: building.id,
                        name: building.name || building.code,
                        type: 'building' as const,
                        children: [],
                        _links: building._links,
                      }))
                      break
                    }
                    case 'building': {
                      const staircases = await fetchApi<StaircaseListResponse>(
                        item._links.staircases.href
                      )
                      item.children = staircases.content.map((staircase) => ({
                        id: staircase.code,
                        name: staircase.name || staircase.code,
                        type: 'staircase' as const,
                        children: [],
                        _links: staircase._links,
                      }))
                      break
                    }
                    case 'staircase': {
                      const residences = await fetchApi<ResidenceListResponse>(
                        item._links.residences.href
                      )
                      item.children = residences.content.map((residence) => ({
                        id: residence.code,
                        name: residence.name || residence.code,
                        type: 'residence' as const,
                        children: [],
                        _links: residence._links,
                      }))
                      break
                    }
                  }
                } catch (error) {
                  console.error(
                    `Failed to load children for ${item.type} ${item.id}:`,
                    error
                  )
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
