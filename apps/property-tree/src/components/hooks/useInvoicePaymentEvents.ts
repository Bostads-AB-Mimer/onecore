import { useQuery } from '@tanstack/react-query'
import { InvoicePaymentEvent } from '@onecore/types'
import { economyService } from '@/services/api/core/economyService'

export const useInvoicePaymentEvents = (invoiceId: string) => {
  return useQuery<InvoicePaymentEvent[], Error>({
    queryKey: ['invoice-payment-events', invoiceId],
    queryFn: () => economyService.getInvoicePaymentEvents(invoiceId),
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!invoiceId,
  })
}
