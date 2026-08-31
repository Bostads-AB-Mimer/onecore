import { useMutation, useQueryClient } from '@tanstack/react-query'

import { inspectionService } from '@/services/api/core'

interface UpdateInspectorVariables {
  inspectionId: string
  inspector: string
}

interface UseUpdateInspectorOptions {
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export const useUpdateInspector = ({
  onSuccess,
  onError,
}: UseUpdateInspectorOptions = {}) => {
  const queryClient = useQueryClient()

  return useMutation<
    Awaited<ReturnType<typeof inspectionService.updateInternalInspection>>,
    Error,
    UpdateInspectorVariables
  >({
    mutationFn: ({ inspectionId, inspector }) =>
      inspectionService.updateInternalInspection(inspectionId, { inspector }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] })
      onSuccess?.()
    },

    onError: (err) => {
      onError?.(err)
    },
  })
}
