import { toast } from '@onecore/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { BffRequestError } from '../../api/errors'
import { useLeasingHost } from '../../host/useLeasingHost'

import { vacantApartmentsQueryKey } from './useVacantApartments'

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vacantApartmentsQueryKey })
    },
    onError: () => {
      toast({ title: 'Kunde inte skapa annonsen', variant: 'destructive' })
    },
  })
}
