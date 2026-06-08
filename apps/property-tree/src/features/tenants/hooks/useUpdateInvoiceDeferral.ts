import { useMutation, useQueryClient } from '@tanstack/react-query'

import { economyService } from '@/services/api/core/economyService'

interface UpdateDeferralParams {
  invoiceId: string
  contactCode: string
  newDueDate: string
}

export const useUpdateInvoiceDeferral = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, UpdateDeferralParams>({
    mutationFn: ({ invoiceId, newDueDate }) =>
      economyService.updateInvoiceDeferralDate(invoiceId, newDueDate),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant-invoices', variables.contactCode],
      })
    },
  })
}
