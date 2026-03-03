import { useMutation, useQueryClient } from '@tanstack/react-query'

import { inspectionService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'

import { useToast } from '@/shared/hooks/useToast'

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
}

export function useUpdateInspectionStatus({
  rentalId,
}: UseUpdateInspectionStatusOptions = {}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

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

    onError: (_err, _vars, context) => {
      if (context?.previousInspections) {
        queryClient.setQueryData(
          ['inspections', rentalId],
          context.previousInspections
        )
      }
      toast({
        title: 'Fel',
        description: 'Kunde inte uppdatera besiktningsstatus.',
        variant: 'destructive',
      })
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] })
      toast({
        title: 'Status uppdaterad',
        description: 'Besiktningsstatus har uppdaterats.',
      })
    },
  })

  return {
    startInspection: (inspectionId: string) =>
      mutation.mutate({ inspectionId, status: INSPECTION_STATUS.IN_PROGRESS }),
    completeInspection: (inspectionId: string) =>
      mutation.mutate({ inspectionId, status: INSPECTION_STATUS.COMPLETED }),
    isPending: mutation.isPending,
  }
}
