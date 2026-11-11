import { toast } from '@onecore/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BffRequestError, describeBffError } from '../../api/errors'
import { useLeasingHost } from '../../host/useLeasingHost'

import {
  vacantApartmentsQueryKey,
  type VacantApartment,
} from './useVacantApartments'

export interface UpdateListingInput {
  listingId: number
  publishedFrom?: string | null
  publishedTo?: string | null
  reviewedAt?: string | null
  reviewedBy?: string | null
  tentativeAvailableFrom?: string | null
}

export function useUpdateListing() {
  const { api } = useLeasingHost()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ listingId, ...body }: UpdateListingInput) => {
      const { data, response } = await api.PATCH(
        '/bostad/listings/{listingId}',
        { params: { path: { listingId } }, body }
      )
      if (!data) throw new BffRequestError(response.status)
      return data.content
    },
    onSuccess: (listing) => {
      // Patch the single row instead of invalidating — see useCreateListing
      // for why (slow, deliberately-cached endpoint; avoids resetting
      // the table's row selection as a side effect of an unrelated save).
      queryClient.setQueryData<VacantApartment[]>(
        vacantApartmentsQueryKey,
        (old) =>
          old?.map((a) =>
            a.listing?.id === listing.id ? { ...a, listing } : a
          )
      )
    },
    onError: (error) => {
      toast({
        title: 'Kunde inte spara annonsen',
        description: describeBffError(error),
        variant: 'destructive',
      })
    },
  })
}
