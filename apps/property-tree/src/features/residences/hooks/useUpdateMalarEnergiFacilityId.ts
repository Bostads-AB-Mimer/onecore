import { useMutation, useQueryClient } from '@tanstack/react-query'

import { residenceService } from '@/services/api/core'

type Variables = {
  rentalId: string
  malarEnergiFacilityId: string
}

type Options = {
  onSuccess?: () => void
  onError?: (error: Error, variables: Variables) => void
}

/**
 * Updates or adds a residence's "Anläggnings ID Mälarenergi". On success the
 * residence query is invalidated so the displayed value refreshes.
 */
export const useUpdateMalarEnergiFacilityId = (options: Options = {}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ rentalId, malarEnergiFacilityId }: Variables) =>
      residenceService.updateMalarEnergiFacilityId(
        rentalId,
        malarEnergiFacilityId
      ),
    onSuccess: (_data, { rentalId }) => {
      queryClient.invalidateQueries({ queryKey: ['residence', rentalId] })
      options.onSuccess?.()
    },
    onError: (err, variables) => {
      options.onError?.(err as Error, variables)
    },
  })
}
