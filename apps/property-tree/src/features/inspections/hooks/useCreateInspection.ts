import { useMutation, useQueryClient } from '@tanstack/react-query'

import { inspectionService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'

type CreateInspectionRequest = components['schemas']['CreateInspectionRequest']
type DetailedInspection = components['schemas']['DetailedInspection']

interface UseCreateInspectionOptions {
  rentalId?: string
}

export const useCreateInspection = ({
  rentalId,
}: UseCreateInspectionOptions) => {
  const queryClient = useQueryClient()

  return useMutation<DetailedInspection, Error, CreateInspectionRequest>({
    mutationFn: (body) => inspectionService.createInspection(body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['inspections', rentalId],
      })
    },
  })
}
