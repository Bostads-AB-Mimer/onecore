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
    return fetchApi<NavigationItem[]>('/navigation')
  },

  async getArea(id: string): Promise<Area> {
    return fetchApi<Area>(`/areas/${id}`)
  },

  async getAreas(): Promise<Area[]> {
    return fetchApi<Area[]>('/areas')
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
