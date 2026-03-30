import { useQuery } from '@tanstack/react-query'

import { economyService } from '@/services/api/core/economyService'

export function useTenantInvoices(
  contactCode: string | undefined,
  from?: Date,
  to?: Date,
  size?: number,
  skip?: number,
  after?: string,
  hasNextXledgerPage?: boolean,
  includePaymentEvents?: boolean
) {
  const invoicesQuery = useQuery({
    queryKey: [
      'tenant-invoices',
      [
        contactCode,
        from,
        to,
        size,
        skip,
        after,
        hasNextXledgerPage,
        includePaymentEvents,
      ].join('|'),
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
        hasNextXledgerPage,
        includePaymentEvents
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
