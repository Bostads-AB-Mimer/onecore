import { useMutation, useQueryClient } from '@tanstack/react-query'

import { inspectionService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'

import { INSPECTION_STATUS } from '../constants/statuses'

type Inspection = components['schemas']['Inspection']
type UpdateInspectionStatusRequest =
  components['schemas']['UpdateInspectionStatusRequest']

interface UpdateInspectionStatusVariables {
  inspectionId: string
  status: UpdateInspectionStatusRequest['status']
}

interface UseUpdateInspectionStatusOptions {
  rentalId?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export const useUpdateInspectionStatus = ({
  rentalId,
  onSuccess,
  onError,
}: UseUpdateInspectionStatusOptions = {}) => {
  const queryClient = useQueryClient()

  const mutation = useMutation<
    Awaited<ReturnType<typeof inspectionService.updateInspectionStatus>>,
    Error,
    UpdateInspectionStatusVariables,
    { previousInspections: Inspection[] | undefined }
  >({
    mutationFn: ({ inspectionId, status }) =>
      inspectionService.updateInspectionStatus(inspectionId, status),

    onMutate: async ({ inspectionId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['inspections', rentalId] })

      const previousInspections = queryClient.getQueryData<Inspection[]>([
        'inspections',
        rentalId,
      ])

      if (previousInspections) {
        queryClient.setQueryData<Inspection[]>(
          ['inspections', rentalId],
          previousInspections.map((i) =>
            i.id === inspectionId ? { ...i, status } : i
          )
        )
      }

      return { previousInspections }
    },

    onError: (err, _vars, context) => {
      if (context?.previousInspections) {
        queryClient.setQueryData(
          ['inspections', rentalId],
          context.previousInspections
        )
      }
      onError?.(err)
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] })
      onSuccess?.()
    },
  })

  return {
    startInspection: (inspectionId: string) =>
      mutation.mutate({ inspectionId, status: INSPECTION_STATUS.IN_PROGRESS }),
    completeInspection: (inspectionId: string) =>
      mutation.mutate({ inspectionId, status: INSPECTION_STATUS.COMPLETED }),
    isPending: mutation.isPending,
    pendingInspectionId: mutation.isPending
      ? mutation.variables?.inspectionId
      : undefined,
  }
}
