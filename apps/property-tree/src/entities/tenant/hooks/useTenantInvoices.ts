import { PaymentStatus } from '@onecore/types'
import { useQuery } from '@tanstack/react-query'

import { economyService } from '@/services/api/core/economyService'

export function useTenantInvoices(
  contactCode: string | undefined,
  from?: Date,
  to?: Date,
  size?: number,
  skip?: number,
  after?: string,
  paymentStatus?: PaymentStatus
) {
  const invoicesQuery = useQuery({
    queryKey: [
      'tenant-invoices',
      [contactCode, from, to, size, skip, after, paymentStatus].join('|'),
    ],
    queryFn: () =>
      economyService.getInvoicesByContactCode(
        contactCode!,
        {
          from,
          to,
        },
        size,
        skip,
        after,
        paymentStatus
      ),
    enabled: !!contactCode,
  })

  const isLoading = invoicesQuery.isLoading
  const error = invoicesQuery.error

  return {
    data: invoicesQuery.data,
    isLoading,
    error,
  }
}
