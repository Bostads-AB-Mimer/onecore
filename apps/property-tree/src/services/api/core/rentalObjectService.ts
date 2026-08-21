import { GET } from './baseApi'
import type { components } from './generated/api-types'

export type RentalObjectRentInfo = components['schemas']['RentalObjectRentInfo']

async function getRentByRentalObjectCode(
  rentalObjectCode: string
): Promise<RentalObjectRentInfo | null> {
  const { data, error, response } = await GET(
    '/rental-objects/by-code/{rentalObjectCode}/rent',
    {
      params: { path: { rentalObjectCode } },
    }
  )

  if (response.status === 404) return null
  if (error) throw error
  if (!data?.content) throw new Error('Response ok but missing content')

  return data.content
}

async function getLegacyRentByRentalObjectCode(
  rentalObjectCode: string
): Promise<RentalObjectRentInfo | null> {
  const { data, error, response } = await GET(
    '/rental-objects/by-code/{rentalObjectCode}/rent-legacy',
    {
      params: { path: { rentalObjectCode } },
    }
  )

  if (response.status === 404) return null
  if (error) throw error
  if (!data?.content) throw new Error('Response ok but missing content')

  return data.content
}

export const rentalObjectService = {
  getRentByRentalObjectCode,
  getLegacyRentByRentalObjectCode,
}
