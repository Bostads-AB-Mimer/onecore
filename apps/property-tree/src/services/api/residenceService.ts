import { Residence } from '../types'
import { GET } from './core/base-api'
import { components } from './core/generated/api-types'

type ResidenceDetails = components['schemas']['ResidenceDetails']

export const residenceService = {
  async getByBuildingCode(buildingCode: string): Promise<Residence[]> {
    const { data, error } = await GET('/propertyBase/residences', {
      params: { query: { buildingCode } },
    })
    if (error) throw error
    return data.content || []
  },

  async getById(residenceId: string): Promise<ResidenceDetails> {
    const { data, error } = await GET('/propertyBase/residence/{residenceId}', {
      params: { path: { residenceId } },
    })

    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')

    return data.content
  },
}
