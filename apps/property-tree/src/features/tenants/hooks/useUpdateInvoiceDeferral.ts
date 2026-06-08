import { useMutation, useQueryClient } from '@tanstack/react-query'

import { economyService } from '@/services/api/core/economyService'

interface UpdateDeferralParams {
  invoiceId: string
  contactCode: string
  endDate: string
  madeByEmail: string
  reason?: string
}

export const useUpdateInvoiceDeferral = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, UpdateDeferralParams>({
    mutationFn: ({ invoiceId, endDate, madeByEmail, reason }) =>
      economyService.updateInvoiceDeferralDate({
        invoiceId,
        endDate,
        madeByEmail,
        reason,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant-invoices', variables.contactCode],
      })
    },
  })
}
