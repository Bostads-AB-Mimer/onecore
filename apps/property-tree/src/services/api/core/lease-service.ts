import { leasing } from '@onecore/types'
import z from 'zod'

import { GET } from './base-api'
import type { components } from './generated/api-types'

export type Lease = components['schemas']['Lease']

type GetLeasesOptions = z.infer<typeof leasing.v1.GetLeasesOptionsSchema>

async function getByRentalPropertyId(
  rentalObjectCode: string,
  params?: GetLeasesOptions
): Promise<Array<Lease>> {
  const { data, error } = await GET(
    '/leases/by-rental-object-code/{rentalObjectCode}',
    {
      params: {
        path: { rentalObjectCode },
        query: {
          includeContacts: params?.includeContacts,
          status: params?.status?.join(','),
        },
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
