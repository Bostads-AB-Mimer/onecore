import { GET } from './baseApi'
import type { components, paths } from './generated/api-types'

export type ApartmentTemperaturePoint =
  components['schemas']['ApartmentTemperaturePoint']
export type ApartmentTemperatureSeries =
  components['schemas']['ApartmentTemperatureSeries']
export type ApartmentTemperaturesResponse =
  components['schemas']['ApartmentTemperaturesResponse']

type TemperaturesQuery =
  paths['/apartments/{objectNumber}/temperatures']['get']['parameters']['query']

export const apartmentTemperatureService = {
  async getByObjectNumber(
    objectNumber: string,
    query?: TemperaturesQuery
  ): Promise<ApartmentTemperaturesResponse> {
    const { data, error } = await GET(
      '/apartments/{objectNumber}/temperatures',
      {
        params: { path: { objectNumber }, query },
      }
    )
    if (error) throw error
    if (!data.content) throw new Error('No data returned from API')
    return data.content
  },
}
