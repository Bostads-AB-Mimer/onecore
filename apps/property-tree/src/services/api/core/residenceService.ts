import { GET } from './base-api'
import { components } from './generated/api-types'

type Residence = components['schemas']['Residence']
type ResidenceDetails = components['schemas']['ResidenceDetails']

export const residenceService = {
  async getByBuildingCode(buildingCode: string): Promise<Residence[]> {
    const { data, error } = await GET('/residences', {
      params: { query: { buildingCode } },
    })
    if (error) throw error
    return data.content || []
  },

  async getById(residenceId: string): Promise<ResidenceDetails> {
    const { data, error } = await GET(`/residences/{residenceId}`, {
      params: { path: { residenceId } },
    })

    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')

    return data.content
  },
}
