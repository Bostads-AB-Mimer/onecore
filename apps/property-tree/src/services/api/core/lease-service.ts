import { GET } from './base-api'
import type { components } from './generated/api-types'

export type Lease = components['schemas']['Lease']

async function getByRentalPropertyId(
  rentalObjectCode: string,
  params?: {
    includeContacts?: boolean
    includeUpcomingLeases?: boolean
    includeTerminatedLeases?: boolean
  }
): Promise<Array<Lease>> {
  const { data, error } = await GET(
    '/leases/by-rental-object-code/{rentalObjectCode}',
    {
      params: {
        path: { rentalObjectCode },
        // TODO: Add status filter
        query: { includeContacts: params?.includeContacts },
      },
    }
  )

  if (error) throw error
  if (!data?.content) throw 'Response ok but missing content'

  return data?.content || []
}

async function getByContactCode(contactCode: string): Promise<Array<Lease>> {
  const { data, error } = await GET('/leases/by-contact-code/{contactCode}', {
    params: { path: { contactCode } },
  })

  if (error) throw error
  if (!data?.content) throw 'Response ok but missing content'

  return data?.content || []
}

export const leaseService = { getByRentalPropertyId, getByContactCode }
