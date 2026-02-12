import { useQuery } from '@tanstack/react-query'
import { residenceService } from '@/services/api/core'

export function useResidence(residenceId: string | undefined) {
  return useQuery({
    queryKey: ['residence', residenceId],
    queryFn: () => residenceService.getById(residenceId!),
    enabled: !!residenceId,
  })
}
