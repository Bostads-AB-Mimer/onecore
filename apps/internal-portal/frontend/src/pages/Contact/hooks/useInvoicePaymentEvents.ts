import { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import {
  Contact,
  Invoice,
  InvoicePaymentEvent,
  InvoiceRow,
  Lease,
} from '@onecore/types'

import apiClient from '../../../utils/api-client'

export type InvoiceWithRows = Invoice & { invoiceRows: InvoiceRow[] }

export type ContactResponse = Contact & {
  invoices: InvoiceWithRows[]
  leases: Lease[]
}

export const useInvoicePaymentEvents = (invoiceId: string) => {
  return useQuery<InvoicePaymentEvent[], AxiosError>({
    queryKey: ['invoice-payment-events', invoiceId],
    queryFn: () =>
      apiClient
        .get<{ content: InvoicePaymentEvent[] }>(
          `/invoices/${invoiceId}/payment-events`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: 'Bearer sometoken',
            },
            withCredentials: true,
          }
        )
        .then((res) => res.data.content),
    refetchOnWindowFocus: false,
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 1
      }
    },
  })
}
