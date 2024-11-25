import { Property, NavigationItem } from '../types'
import apiClient from './apiClient'

interface ApiProperty {
  id: string
  name: string
  address: string
  constructionYear: number
  lastRenovation?: number
  buildings: string[]
  totalApartments: number
  occupiedApartments: number
}

export const propertyService = {
  // Get all properties
  async getAll(): Promise<Property[]> {
    try {
      const { data } = await apiClient.get<ApiProperty[]>('/api/properties/')
      return data.map((property) => ({
        id: property.id,
        name: property.name,
        address: property.address,
        areaId: '', // Will be populated when area structure is available
        buildings: property.buildings,
        totalApartments: property.totalApartments,
        occupiedApartments: property.occupiedApartments,
        constructionYear: property.constructionYear,
        lastRenovation: property.lastRenovation,
      }))
    } catch (error) {
      console.error('Failed to fetch properties:', error)
      throw new Error('Failed to load properties')
    }
  },

  // Get property by ID
  async getById(id: string): Promise<Property> {
    const { data } = await apiClient.get<ApiProperty>(`/api/properties/${id}`)
    return {
      id: data.id,
      name: data.name,
      address: data.address,
      areaId: '', // Will be populated when area structure is available
      buildings: data.buildings,
      totalApartments: data.totalApartments,
      occupiedApartments: data.occupiedApartments,
      constructionYear: data.constructionYear,
      lastRenovation: data.lastRenovation,
    }
  },

  // Create new property
  async create(data: Omit<Property, 'id'>): Promise<Property> {
    const { data: response } = await apiClient.post<ApiProperty>(
      '/api/properties/',
      data
    )
    return {
      id: response.id,
      name: response.name,
      address: response.address,
      areaId: '', // Will be populated when area structure is available
      buildings: response.buildings,
      totalApartments: response.totalApartments,
      occupiedApartments: response.occupiedApartments,
      constructionYear: response.constructionYear,
      lastRenovation: response.lastRenovation,
    }
  },

  // Update property
  async update(id: string, data: Partial<Property>): Promise<Property> {
    const { data: response } = await apiClient.put<ApiProperty>(
      `/api/properties/${id}`,
      data
    )
    return {
      id: response.id,
      name: response.name,
      address: response.address,
      areaId: '', // Will be populated when area structure is available
      buildings: response.buildings,
      totalApartments: response.totalApartments,
      occupiedApartments: response.occupiedApartments,
      constructionYear: response.constructionYear,
      lastRenovation: response.lastRenovation,
    }
  },
}
