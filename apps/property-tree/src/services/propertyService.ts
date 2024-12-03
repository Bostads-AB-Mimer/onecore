import {
  NavigationItem,
  Residence,
  Area,
  Property,
  Building,
  Staircase,
} from './types'
import { fetchApi } from './api/baseApi'
import { residenceService } from './api/residenceService'

export const propertyService = {
  async getNavigation(): Promise<NavigationItem[]> {
    // Get all areas
    const areas = await this.getAreas()
    
    // Build navigation tree
    const navigationItems: NavigationItem[] = await Promise.all(
      areas.map(async (area) => {
        // Get properties for this area
        const properties = await this.getProperties()
        const areaProperties = properties.filter(p => p.areaId === area.id)
        
        // Get buildings and staircases for each property
        const propertyItems = await Promise.all(
          areaProperties.map(async (property) => {
            const buildings = await this.getBuildings(property.id)
            
            const buildingItems = await Promise.all(
              buildings.map(async (building) => {
                const staircases = await this.getStaircases(building.id)
                
                return {
                  id: building.id,
                  name: building.name,
                  type: 'building' as const,
                  children: staircases.map(staircase => ({
                    id: staircase.id,
                    name: staircase.name,
                    type: 'staircase' as const,
                    children: []
                  }))
                }
              })
            )

            return {
              id: property.id,
              name: property.name,
              type: 'property' as const,
              children: buildingItems
            }
          })
        )

        return {
          id: area.id,
          name: area.name,
          type: 'area' as const,
          children: propertyItems
        }
      })
    )

    return navigationItems
  },

  async getArea(id: string): Promise<Area> {
    return fetchApi<Area>(`/areas/${id}`)
  },

  private _propertiesCache: Property[] | null = null
  private _lastFetchTime: number = 0
  private readonly _CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  private async ensurePropertiesCache(): Promise<Property[]> {
    const now = Date.now()
    if (!this._propertiesCache || 
        now - this._lastFetchTime > this._CACHE_TTL) {
      this._propertiesCache = await this.getProperties()
      this._lastFetchTime = now
    }
    return this._propertiesCache
  }

  async getAreas(): Promise<Area[]> {
    // Get all properties first
    const properties = await this.ensurePropertiesCache()
    
    // Get unique area IDs from properties
    const areaIds = [...new Set(properties.map(p => p.areaId))]
    
    // Fetch area details and combine with property counts
    const areas = await fetchApi<Area[]>('/areas')
    
    return areas.map(area => {
      const areaProperties = properties.filter(p => p.areaId === area.id)
      return {
        ...area,
        properties: areaProperties.map(p => p.id),
        totalApartments: areaProperties.reduce((sum, p) => sum + p.totalApartments, 0),
        occupiedApartments: areaProperties.reduce((sum, p) => sum + p.occupiedApartments, 0)
      }
    })
  },

  async getProperty(id: string): Promise<Property> {
    return fetchApi<Property>(`/properties/${id}`)
  },

  async getProperties(): Promise<Property[]> {
    return fetchApi<Property[]>('/properties')
  },

  async getBuilding(id: string): Promise<Building> {
    return fetchApi<Building>(`/buildings/${id}`)
  },

  async getBuildings(propertyId: string): Promise<Building[]> {
    return fetchApi<Building[]>(`/properties/${propertyId}/buildings`)
  },

  async getStaircase(id: string): Promise<Staircase> {
    return fetchApi<Staircase>(`/staircases/${id}`)
  },

  async getStaircases(buildingId: string): Promise<Staircase[]> {
    return fetchApi<Staircase[]>(`/buildings/${buildingId}/staircases`)
  },

  async getResidence(id: string): Promise<Residence> {
    return residenceService.getById(id)
  },

  async getResidences(staircaseId: string): Promise<Residence[]> {
    return residenceService.getByEntranceId(staircaseId)
  },

  async searchProperties(query: string): Promise<NavigationItem[]> {
    return fetchApi<NavigationItem[]>(`/search?q=${encodeURIComponent(query)}`)
  },
}
