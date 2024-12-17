import {
  Building,
  BuildingWithLinks,
  ResidenceWithLinks,
  Staircase,
  StaircaseWithLinks,
} from '../types'
import { fetchApi } from './baseApi'

interface BuildingResponse {
  content: BuildingWithLinks[]
}

interface BuildingDetailsResponse {
  content: BuildingWithLinks
}

interface StaircaseResponse {
  content: StaircaseWithLinks[]
}

interface ResidenceResponse {
  content: ResidenceWithLinks[]
}

export const buildingService = {
  // Get buildings by property code
  async getByPropertyCode(propertyCode: string): Promise<Building[]> {
    const response = await fetchApi<BuildingResponse>(
      `/buildings?propertyCode=${propertyCode}`
    )
    return response.content
  },

  // Get building by ID
  async getById(id: string): Promise<Building> {
    const response = await fetchApi<BuildingDetailsResponse>(`/buildings/${id}`)
    return response.content
  },

  // Get building staircases
  async getBuildingStaircases(building: BuildingWithLinks) {
    const response = await fetchApi<StaircaseResponse>(
      `/staircases?buildingCode=${building.code}`
    )
    return response.content
  },

  // Get building residences
  async getBuildingResidences(building: BuildingWithLinks) {
    const response = await fetchApi<ResidenceResponse>(
      `/residences?buildingCode=${building.code}`
    )
    return response.content
  }
}
