import { useQuery } from '@tanstack/react-query'
import { economyService } from '@/services/api/core/economyService'

export function useTenantInvoices(contactCode: string | undefined) {
  const invoicesQuery = useQuery({
    queryKey: ['tenant-invoices', contactCode],
    queryFn: () => economyService.getInvoicesByContactCode(contactCode!),
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
