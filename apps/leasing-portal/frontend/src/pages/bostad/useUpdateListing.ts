import { toast } from '@onecore/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BffRequestError } from '../../api/errors'
import { useLeasingHost } from '../../host/useLeasingHost'

import { vacantApartmentsQueryKey } from './useVacantApartments'

export interface UpdateListingInput {
  listingId: number
  publishedFrom?: string | null
  publishedTo?: string | null
  reviewedAt?: string | null
  reviewedBy?: string | null
  availableFrom?: string | null
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vacantApartmentsQueryKey })
    },
    onError: () => {
      toast({ title: 'Kunde inte spara annonsen', variant: 'destructive' })
    },
  })
}
