import { Invoice } from '@onecore/types'
import { useMutation } from '@tanstack/react-query'

import {
  economyService,
  type SendInvoiceError,
} from '@/services/api/core/economyService'

export type { SendInvoiceError }

// Emailing an invoice changes no data the app shows, so nothing is invalidated.
export const useSendInvoiceToCustomer = () =>
  useMutation<void, SendInvoiceError, Invoice>({
    mutationFn: (invoice) =>
      economyService.sendInvoiceToCustomer({
        invoiceId: invoice.invoiceId,
        invoiceType: invoice.type,
      }),
  })
