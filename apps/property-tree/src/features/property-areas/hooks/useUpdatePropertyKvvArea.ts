import { useMutation } from '@tanstack/react-query'

import { propertyService } from '@/services/api/core'

type Variables = {
  propertyCode: string
  kvvAreaId: string
}

type Options = {
  onSuccess?: () => void
  onError?: (error: Error, variables: Variables) => void
}

// Intentionally does NOT invalidate ['costCenterTree'] on each success — the
// caller batches mutations and invalidates once after all settle.
export const useUpdatePropertyKvvArea = (options: Options = {}) => {
  return useMutation({
    mutationFn: ({ propertyCode, kvvAreaId }: Variables) =>
      propertyService.updateKvvArea(propertyCode, kvvAreaId),
    onSuccess: () => {
      options.onSuccess?.()
    },
    onError: (err, variables) => {
      options.onError?.(err as Error, variables)
    },
  })
}
