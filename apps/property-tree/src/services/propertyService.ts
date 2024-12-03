import {
  NavigationItem,
  Residence,
  Area,
  Property,
  Building,
  Entrance,
} from './types'
import { fetchApi } from './api/baseApi'
import { residenceService } from './api/residenceService'

// Convert tenant to search result
const createTenantSearchResult = (
  residenceId: string,
  tenant: Residence['tenant'],
): NavigationItem => ({
  id: `tenant-${residenceId}`,
  name: tenant.name,
  type: 'tenant',
  metadata: {
    residenceId,
    email: tenant.email,
    phone: tenant.phone,
  },
})

export const propertyService = {
  async getNavigation(): Promise<NavigationItem[]> {
    return fetchApi<NavigationItem[]>('/navigation')
  },

  async getArea(id: string): Promise<Area> {
    return fetchApi<Area>(`/areas/${id}`)
  },

  async getProperty(id: string): Promise<Property> {
    return fetchApi<Property>(`/properties/${id}`)
  },

  async getBuilding(id: string): Promise<Building> {
    return fetchApi<Building>(`/buildings/${id}`)
  },

  async getEntrance(id: string): Promise<Entrance> {
    return fetchApi<Entrance>(`/entrances/${id}`)
  },

  async getResidence(id: string): Promise<Residence> {
    return residenceService.getById(id)
  },

  async searchProperties(query: string): Promise<NavigationItem[]> {
    return fetchApi<NavigationItem[]>(`/search?q=${encodeURIComponent(query)}`)
  },
}
