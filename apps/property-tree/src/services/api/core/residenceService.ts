import { GET } from './base-api'
import { components } from './generated/api-types'

type Residence = components['schemas']['Residence']
type ResidenceDetails = components['schemas']['ResidenceDetails']
type ResidenceSummary = components['schemas']['ResidenceSummary']

export const residenceService = {
  async getByBuildingCode(buildingCode: string): Promise<Residence[]> {
    const { data, error } = await GET('/residences', {
      params: { query: { buildingCode } },
    })
    if (error) throw error
    return data.content || []
  },

  async getByBuildingCodeAndStaircaseCode(
    buildingCode: string,
    staircaseCode: string
  ): Promise<ResidenceSummary[]> {
    const { data, error } = await GET(
      '/residences/summary/by-building-code/{buildingCode}',
      {
        params: { path: { buildingCode }, query: { staircaseCode } },
      }
    )
    if (error) throw error
    return data.content || []
  },

  async getById(residenceId: string): Promise<ResidenceDetails> {
    const { data, error } = await GET(`/residences/{residenceId}`, {
      params: {
        path: { residenceId },
        query: { includeActiveBlocksOnly: true },
      },
    })

    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')

    return data.content
  },

  async getRentalBlocksByRentalId(
    rentalId: string,
    includeActiveBlocksOnly = false
  ): Promise<components['schemas']['RentalBlock'][]> {
    const { data, error } = await GET(
      '/residences/rental-blocks/by-rental-id/{rentalId}',
      {
        params: { path: { rentalId }, query: { includeActiveBlocksOnly } },
      }
    )
    if (error) throw error
    return data.content || []
  },
}
