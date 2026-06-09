import { useMutation, useQueryClient } from '@tanstack/react-query'

import { economyService } from '@/services/api/core/economyService'
import type { paths } from '@/services/api/core/generated/api-types'

type DeferralBody =
  paths['/invoices/{invoiceId}/deferral']['put']['requestBody']['content']['application/json']

interface UpdateDeferralParams extends DeferralBody {
  invoiceId: string
  contactCode: string
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
