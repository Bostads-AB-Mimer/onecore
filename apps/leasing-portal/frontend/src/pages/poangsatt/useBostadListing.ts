import { useQuery } from '@tanstack/react-query'

import { BffRequestError } from '../../api/errors'
import { useLeasingHost } from '../../host/useLeasingHost'
import type { paths } from '../../api/generated/api-types'

export type BostadListing =
  paths['/bostad/listings/{listingId}']['get']['responses'][200]['content']['application/json']['content']

export const bostadListingQueryKey = (listingId: string) => [
  'leasing',
  'bostad',
  'listing',
  listingId,
]

/** One apartment listing with its object information, for the listing page. */
export function useBostadListing(listingId: string) {
  const { api } = useLeasingHost()

  return useQuery({
    queryKey: bostadListingQueryKey(listingId),
    queryFn: async (): Promise<BostadListing> => {
      const { data, response } = await api.GET('/bostad/listings/{listingId}', {
        params: { path: { listingId } },
      })
      if (!data) throw new BffRequestError(response.status)
      return data.content
    },
  })
}
