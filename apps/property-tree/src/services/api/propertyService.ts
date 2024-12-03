import { Property, NavigationItem } from '../types'
import { fetchApi, simulateDelay } from './baseApi'
import { mockProperties, mockNavigation } from '../mockData'

export const propertyService = {
  // Get all properties
  async getAll(): Promise<PropertyList> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const items = Object.values(mockProperties)
    return {
      items,
      total: items.length,
    }
  },

  // Get property by ID
  async getById(id: string): Promise<Property> {
    // TODO: Replace with actual API call
    await simulateDelay()
    const property = mockProperties[id]
    if (!property) {
      throw new Error(`Property with id ${id} not found`)
    }
    return property
  },

  // Get properties by area ID
  async getByAreaId(areaId: string): Promise<Property[]> {
    // TODO: Replace with actual API call
    await simulateDelay()
    return Object.values(mockProperties).filter(
      (property) => property.tract === areaId
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
