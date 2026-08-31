import { useQuery } from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'

export function useResidence(rentalId: string | undefined) {
  return useQuery({
    queryKey: ['residence', rentalId],
    queryFn: () => residenceService.getByRentalId(rentalId!),
    enabled: !!rentalId,
  })
}
