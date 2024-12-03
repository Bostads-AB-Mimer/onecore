import { Building, NavigationItem, Property, Staircase } from '../types'
import { fetchApi } from './baseApi'

// Cache singleton
let propertiesCache: Property[] | null = null
let lastCacheUpdate: number = 0
let cacheUpdatePromise: Promise<void> | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Types based on API schema
interface PropertyResponse {
  content: Property[]
}

interface SinglePropertyResponse {
  content: Property
}

interface StaircaseResponse {
  content: Staircase[]
}

export const propertyService = {
  // Get all properties with optional tract filter
  async getAll(tract?: string): Promise<Property[]> {
    const now = Date.now()
    
    // Refresh cache if expired or doesn't exist
    if (!propertiesCache || (now - lastCacheUpdate) > CACHE_TTL) {
      // If there's already a cache update in progress, wait for it
      if (!cacheUpdatePromise) {
        cacheUpdatePromise = (async () => {
          try {
            const response = await fetchApi<PropertyResponse>('/properties/')
            propertiesCache = response.content
            lastCacheUpdate = now
          } finally {
            cacheUpdatePromise = null
          }
        })()
      }
      await cacheUpdatePromise
    }

    // Filter by tract if specified
    if (tract) {
      return propertiesCache!.filter(p => p.tract === tract)
    }

    return propertiesCache!
  },

  // Get unique areas (tracts) from all properties
  async getAreas(): Promise<string[]> {
    const properties = await this.getAll()
    const uniqueAreas = new Set(properties.map(p => p.tract).filter(Boolean))
    return Array.from(uniqueAreas).sort()
  },

  // Get property by ID
  async getById(id: string): Promise<Property> {
    const response = await fetchApi<SinglePropertyResponse>(
      `/properties/${id}/`
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
    // Get all properties first
    const properties = await this.getAll()

    // Build navigation tree
    const navigationItems: NavigationItem[] = await Promise.all(
      properties.map(async (property) => {
        // Get buildings for this property
        const buildings = await this.getBuildingsByPropertyCode(
          property.propertyDesignation.code
        )

        // Get staircases for each building
        const buildingItems = await Promise.all(
          buildings.map(async (building) => {
            const staircases = await this.getStaircasesByBuildingCode(
              building.code
            )

            return {
              id: building.id,
              name: building.name,
              type: 'building' as const,
              children: staircases.map((staircase) => ({
                id: staircase.id,
                name: staircase.name || staircase.code,
                type: 'staircase' as const,
                children: [],
              })),
            }
          })
        )

        return {
          id: property.id,
          name: property.propertyDesignation.name || property.code,
          type: 'property' as const,
          children: buildingItems,
        }
      })
    )

    return navigationItems
  },
}
