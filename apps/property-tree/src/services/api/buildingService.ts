import {
  Building,
  BuildingWithLinks,
  ResidenceWithLinks,
  Staircase,
  StaircaseWithLinks,
} from '../types'
import { fetchApi } from './baseApi'

interface BuildingListResponse {
  content: BuildingWithLinks[]
}

interface BuildingDetailsResponse {
  content: BuildingWithLinks
}

interface BuildingStaircasesResponse {
  content: StaircaseWithLinks[]
}

interface BuildingResidencesResponse {
  content: ResidenceWithLinks[]
}

export const buildingService = {
  // Get buildings by property code
  async getByPropertyCode(propertyCode: string): Promise<Building[]> {
    const response = await fetchApi<BuildingListResponse>(
      `/buildings?propertyCode=${propertyCode}`
    )
    return response.content
  },

  // Get building by ID
  async getById(id: string): Promise<Building> {
    const response = await fetchApi<BuildingDetailsResponse>(`/buildings/${id}`)
    return response.content
  },

  // Get building staircases using HATEOAS link
  async getBuildingStaircases(building: BuildingWithLinks) {
    const response = fetchApi<BuildingStaircasesResponse>(
      building._links.staircases.href
    )
    return (await response).content
  },

  // Get building residences using HATEOAS link
  async getBuildingResidences(building: BuildingWithLinks) {
    const response = fetchApi<BuildingResidencesResponse>(
      building._links.residences.href
    )
    return (await response).content
  },

  // Get building statistics
  async getBuildingStats(id: string) {
    const response = await fetchApi<{
      totalResidences: number
      occupiedResidences: number
      totalArea: number
      averageRent: number
    }>(`/buildings/${id}/statistics`)
    return response
  },
}
