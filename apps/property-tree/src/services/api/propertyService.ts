import { Property, NavigationItem } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockProperties, mockNavigation } from '../mockData'

interface ApiArea {
  areaId: string
  areaName: string
  properties: ApiProperty[]
}

interface ApiProperty {
  propertyId: string
  propertyCode: string
  tract: string
  propertyDesignation: string
  constructionYear: number
  lastRenovation?: number
}

interface ApiResponse {
  content: ApiArea[]
}

const mapApiPropertyToProperty = (
  apiProperty: ApiProperty,
  areaId: string
): Property => ({
  id: apiProperty.propertyId.trim(),
  name: apiProperty.propertyDesignation,
  address: apiProperty.tract,
  areaId: areaId,
  buildings: [],
  totalApartments: 0,
  occupiedApartments: 0,
  constructionYear: apiProperty.constructionYear,
  lastRenovation: apiProperty.lastRenovation,
})

const mapApiAreaToArea = (apiArea: ApiArea): Area => ({
  id: apiArea.areaId.trim(),
  name: apiArea.areaName,
  properties: apiArea.properties.map((property) => property.propertyId.trim()),
  totalApartments: 0, // Assuming totalApartments are not provided by the API
  occupiedApartments: 0, // Assuming occupiedApartments are not provided by the API
  totalProperties: apiArea.properties.length,
})

export const propertyService = {
  // Get all properties
  async getAll(): Promise<Property[]> {
    try {
      const response = await fetchApi<ApiResponse>(
        'http://localhost:5050/properties/'
      )
      const areas = response.content.map(mapApiAreaToArea)
      const properties = response.content.flatMap((area) =>
        area.properties.map((property) =>
          mapApiPropertyToProperty(property, area.areaId)
        )
      )
      // You might want to store or use areas somewhere in your application
      return properties
    } catch (error) {
      console.error('Failed to fetch properties:', error)
      throw new Error('Failed to load properties')
    }
  },

  // Get property by ID
  async getById(id: string): Promise<Property> {
    const apiProperty = await fetchApi<ApiProperty>(
      `http://localhost:5050/properties/_${id}/`
    )
    return mapApiPropertyToProperty(apiProperty)
  },

  // Get properties by area ID
  async getByAreaId(areaId: string): Promise<Property[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return Object.values(mockProperties).filter(
      (property) => property.areaId === areaId
    )
  },

  // Get navigation tree
  async getNavigation(): Promise<NavigationItem[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return mockNavigation
  },

  // Create new property
  async create(data: Omit<Property, 'id'>): Promise<Property> {
    // TODO: Replace with actual API call
    return fetchApi<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update property
  async update(id: string, data: Partial<Property>): Promise<Property> {
    // TODO: Replace with actual API call
    return fetchApi<Property>(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete property
  async delete(id: string): Promise<void> {
    // TODO: Replace with actual API call
    return fetchApi<void>(`/properties/${id}`, {
      method: 'DELETE',
    })
  },
}
