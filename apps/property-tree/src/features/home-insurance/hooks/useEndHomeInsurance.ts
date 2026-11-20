import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  type EndHomeInsuranceRowBody,
  homeInsuranceService,
} from '@/services/api/core/homeInsuranceService'

import { useToast } from '@/shared/hooks/useToast'

import { endHomeInsuranceErrorMessage } from '../lib/homeInsuranceEnd'

type Variables = EndHomeInsuranceRowBody & { leaseId: string; rowId: string }

/**
 * Ends or removes a home insurance row. The toasts and the refetch sit on the
 * mutation itself, not on mutate(), so they still run when the row's dialog
 * unmounts because the list reloaded with the row's new rowId.
 */
export function useEndHomeInsurance() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const refetchRows = (leaseId: string) => {
    queryClient.invalidateQueries({ queryKey: ['homeInsurances'] })
    queryClient.invalidateQueries({ queryKey: ['leaseHomeInsurance', leaseId] })
    // Every lease query starts with 'leases'; their rentRows hold the row.
    queryClient.invalidateQueries({ queryKey: ['leases'] })
    queryClient.invalidateQueries({ queryKey: ['rentalObjectRent'] })
  }

  return useMutation({
    mutationFn: ({ leaseId, rowId, endDate, action }: Variables) =>
      homeInsuranceService.endRow(leaseId, rowId, { endDate, action }),
    onSuccess: (result, { endDate }) =>
      toast({
        title:
          result.action === 'deleted'
            ? 'Hemförsäkringen är borttagen'
            : `T.o.m. är satt till ${endDate}`,
      }),
    onError: (error) =>
      toast({
        title: endHomeInsuranceErrorMessage(error),
        variant: 'destructive',
      }),
    // Also after an error: a 409 means the rows changed, and a 503 or 500 can
    // come after a write that went through. Show the rows as they are now.
    onSettled: (_data, _error, { leaseId }) => refetchRows(leaseId),
  })
}
