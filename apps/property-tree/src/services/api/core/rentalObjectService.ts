import { GET } from './baseApi'
import type { components } from './generated/api-types'

export type RentalObjectSummary = components['schemas']['RentalObjectSummary']
export type RentalObjectType = RentalObjectSummary['type']

export const rentalObjectService = {
  /** All rental objects (bostad/bilplats/lokal/övrigt) of one property. */
  async getByPropertyCode(
    propertyCode: string
  ): Promise<RentalObjectSummary[]> {
    const { data, error } = await GET('/rental-objects', {
      params: { query: { propertyCode } },
    })
    if (error) throw error
    return data.content ?? []
  },
}
