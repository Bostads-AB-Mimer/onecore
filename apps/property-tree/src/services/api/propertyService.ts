import { Building, NavigationItem, Property, Staircase } from '../types'
import { fetchApi } from './baseApi'
import { Cache } from '../../utils/cache'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const propertiesCache = new Cache<Property[]>(CACHE_TTL)
const buildingsCache = new Cache<Record<string, Building[]>>(CACHE_TTL)
const staircasesCache = new Cache<Record<string, Staircase[]>>(CACHE_TTL)

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
    const properties = await propertiesCache.get(async () => {
      const response = await fetchApi<PropertyResponse>('/properties/')
      return response.content
    })

    // Filter by tract if specified
    if (tract) {
      return properties.filter(p => p.tract === tract)
    }

    return properties
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
    return buildingsCache.get(async () => {
      const response = await fetchApi<Building[]>(`/buildings/${propertyCode}/`)
      return response
    })
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
    return staircasesCache.get(async () => {
      const response = await fetchApi<StaircaseResponse>(
        `/staircases/${buildingCode}/`
      )
      return response.content
    })
  },

  // Get navigation tree
  async getNavigationTree(): Promise<NavigationItem[]> {
    // Get all properties first using the cache
    const properties = await this.getAll()

    // Group properties by area
    const propertiesByArea = properties.reduce((acc, property) => {
      const area = property.tract || 'Övriga'
      if (!acc[area]) acc[area] = []
      acc[area].push(property)
      return acc
    }, {} as Record<string, Property[]>)

    // Create a map to store building data for each property
    const buildingsByProperty: Record<string, Building[]> = {}
    
    // Fetch all buildings in parallel
    await Promise.all(
      properties.map(async (property) => {
        buildingsByProperty[property.propertyDesignation.code] = 
          await this.getBuildingsByPropertyCode(property.propertyDesignation.code)
      })
    )

    // Create a map to store staircase data for each building
    const staircasesByBuilding: Record<string, Staircase[]> = {}
    
    // Fetch all staircases in parallel
    await Promise.all(
      Object.values(buildingsByProperty).flat().map(async (building) => {
        staircasesByBuilding[building.code] = 
          await this.getStaircasesByBuildingCode(building.code)
      })
    )

    // Build navigation tree using the cached data
    return Object.entries(propertiesByArea).map(([areaName, areaProperties]) => ({
      id: areaName,
      name: areaName,
      type: 'area' as const,
      children: areaProperties.map((property) => {
        const buildings = buildingsByProperty[property.propertyDesignation.code] || []
        
        const buildingItems = buildings.map((building) => {
          const staircases = staircasesByBuilding[building.code] || []
          
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

        return {
          id: property.id,
          name: property.propertyDesignation.name || property.code,
          type: 'property' as const,
          children: buildingItems,
        }
      }),
    }))
  },
}
