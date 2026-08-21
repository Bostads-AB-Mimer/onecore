import { GET } from './baseApi'
import type { components } from './generated/api-types'

export type RentalObjectRentInfo = components['schemas']['RentalObjectRentInfo']

async function getRentByRentalObjectCode(
  rentalObjectCode: string
): Promise<RentalObjectRentInfo> {
  const { data, error } = await GET(
    '/rental-objects/by-code/{rentalObjectCode}/rent',
    {
      params: { path: { rentalObjectCode } },
    }
  )

  if (error) throw error
  if (!data?.content) throw new Error('Response ok but missing content')

  return data.content
}

export const rentalObjectService = { getRentByRentalObjectCode }
