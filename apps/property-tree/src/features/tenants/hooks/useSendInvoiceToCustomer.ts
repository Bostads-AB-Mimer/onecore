import { useMutation } from '@tanstack/react-query'

import {
  economyService,
  type SendInvoiceError,
} from '@/services/api/core/economyService'

export type { SendInvoiceError }

// Emailing an invoice changes no data the app shows, so nothing is invalidated.
export const useSendInvoiceToCustomer = () =>
  useMutation<void, SendInvoiceError, string>({
    mutationFn: economyService.sendInvoiceToCustomer,
  })
