import { toast } from '@onecore/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BffRequestError, describeBffError } from '../../api/errors'
import { useLeasingHost } from '../../host/useLeasingHost'

import {
  vacantApartmentsQueryKey,
  type VacantApartment,
} from './useVacantApartments'

export function useCreateListing() {
  const { api } = useLeasingHost()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (rentalObjectCode: string) => {
      const { data, response } = await api.POST('/bostad/listings', {
        body: { rentalObjectCode },
      })
      if (!data) throw new BffRequestError(response.status)
      return data.content
    },
    onSuccess: (listing, rentalObjectCode) => {
      // Patch the single row instead of invalidating — this endpoint is
      // deliberately cached for 5 minutes (slow upstream Tenfast paging),
      // and a full refetch here would also reset the table's row selection.
      queryClient.setQueryData<VacantApartment[]>(
        vacantApartmentsQueryKey,
        (old) =>
          old?.map((a) =>
            a.rentalObjectCode === rentalObjectCode ? { ...a, listing } : a
          )
      )
    },
    onError: (error) => {
      toast({
        title: 'Kunde inte skapa annonsen',
        description: describeBffError(error),
        variant: 'destructive',
      })

      // 409 means someone else already created a listing for this apartment
      // since the list was last fetched (it's cached for 5 minutes). Without
      // this, the row keeps showing no listing and "Redigera annons" stays
      // stuck disabled until the cache expires on its own.
      if (error instanceof BffRequestError && error.status === 409) {
        queryClient.invalidateQueries({ queryKey: vacantApartmentsQueryKey })
      }
    },
  })
}
