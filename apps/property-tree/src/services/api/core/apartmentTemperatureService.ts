import { resolve } from '@/shared/lib/env'

const CORE_API_URL = resolve('VITE_CORE_API_URL', 'http://localhost:5010')

// Local type mirrors core's ApartmentTemperaturesResponse. After running
// `pnpm run generate-api-types:core` against a core build that exposes
// /apartments/{objectNumber}/temperatures, this can be swapped to
// `components['schemas']['ApartmentTemperaturesResponse']` and the call
// migrated to the typed `GET` helper in baseApi.ts.
export type ApartmentTemperaturePoint = {
  time: number
  avg: number | null
  min: number | null
  max: number | null
}

export type ApartmentTemperatureSeries = {
  subNodeId: number
  subNodeName: string
  points: ApartmentTemperaturePoint[]
}

export type ApartmentTemperaturesResponse = {
  objectNumber: string
  nodeId: number
  from: number
  to: number
  interval: 'H' | 'D'
  unit: string
  series: ApartmentTemperatureSeries[]
}

export const apartmentTemperatureService = {
  async getByObjectNumber(
    objectNumber: string,
    query?: { from?: number; to?: number; interval?: 'H' | 'D' }
  ): Promise<ApartmentTemperaturesResponse> {
    const params = new URLSearchParams()
    if (query?.from !== undefined) params.set('from', String(query.from))
    if (query?.to !== undefined) params.set('to', String(query.to))
    if (query?.interval) params.set('interval', query.interval)

    const search = params.toString() ? `?${params}` : ''
    const url = `${CORE_API_URL}/apartments/${encodeURIComponent(
      objectNumber
    )}/temperatures${search}`

    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) {
      throw new Error(
        `Failed to fetch apartment temperatures: ${response.status}`
      )
    }

    const data = await response.json()
    if (!data?.content) throw new Error('No data returned from API')
    return data.content as ApartmentTemperaturesResponse
  },
}
