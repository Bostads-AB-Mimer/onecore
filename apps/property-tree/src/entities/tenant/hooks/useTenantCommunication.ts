import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { communicationService } from '@/services/api/core/communicationService'

export function useTenantCommunication(contactCode: string | undefined) {
  const queryClient = useQueryClient()

  const communicationQuery = useQuery({
    queryKey: ['tenant-communication', contactCode],
    queryFn: () => communicationService.getCustomerMessages(contactCode!),
    enabled: !!contactCode,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['tenant-communication'] })

  const cancelMutation = useMutation({
    mutationFn: (dispatchId: string) =>
      communicationService.cancelDispatch(dispatchId),
    onSuccess: invalidate,
  })

  const rescheduleMutation = useMutation({
    mutationFn: ({
      dispatchId,
      sendAt,
    }: {
      dispatchId: string
      sendAt: string
    }) => communicationService.rescheduleDispatch(dispatchId, sendAt),
    onSuccess: invalidate,
  })

  return {
    data: communicationQuery.data,
    isLoading: communicationQuery.isLoading,
    error: communicationQuery.error,
    cancelDispatch: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    rescheduleDispatch: rescheduleMutation.mutateAsync,
    isRescheduling: rescheduleMutation.isPending,
  }
}
