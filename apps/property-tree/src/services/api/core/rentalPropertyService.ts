import type { RentalPropertyInfo } from '@onecore/types'

import { GET } from './baseApi'

async function getByRentalObjectCode(
  rentalObjectCode: string
): Promise<RentalPropertyInfo> {
  const { data, error } = await GET(
    '/rental-properties/by-rental-object-code/{rentalObjectCode}',
    {
      params: { path: { rentalObjectCode } },
    }
  )

  if (error) throw error

  // Type assertion needed because generated types are incomplete
  const response = data as any
  if (!response?.content) throw new Error('Response ok but missing content')

  return response.content as RentalPropertyInfo
}

export const rentalPropertyService = { getByRentalObjectCode }
