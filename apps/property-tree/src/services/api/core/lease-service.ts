import { GET } from './base-api'
import type { components } from './generated/api-types'

export type Lease = components['schemas']['Lease']

async function getByRentalPropertyId(
  rentalPropertyId: string,
  params?: {
    includeContacts?: boolean
    includeUpcomingLeases?: boolean
    includeTerminatedLeases?: boolean
    includeRentInfo?: boolean
  }
): Promise<Array<Lease>> {
  const { data, error } = await GET(
    '/leases/by-rental-property-id/{rentalPropertyId}',
    {
      params: { path: { rentalPropertyId }, query: params },
    }
  )

  if (error) throw error
  if (!data?.content) throw 'Response ok but missing content'

  return data?.content || []
}

async function getByContactCode(contactCode: string): Promise<Array<Lease>> {
  const { data, error } = await GET('/leases/by-contact-code/{contactCode}', {
    params: {
      path: { contactCode },
      query: { includeTerminatedLeases: 'true' },
    },
  })

  if (error) throw error
  if (!data?.content) throw 'Response ok but missing content'

  return data?.content || []
}

export const leaseService = { getByRentalPropertyId, getByContactCode }
