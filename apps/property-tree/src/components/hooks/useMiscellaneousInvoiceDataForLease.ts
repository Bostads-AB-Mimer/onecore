import { useQuery } from '@tanstack/react-query'
import { economyService } from '@/services/api/core/economyService'

export function useMiscellaneousInvoiceDataForLease(leaseId?: string) {
  const query = useQuery({
    queryKey: ['miscellaneous-invoice-lease', leaseId],
    queryFn: () => economyService.getMiscellaneousInvoiceDataForLease(leaseId!),
    enabled: !!leaseId,
  })

  const isLoading = query.isLoading
  const error = query.error

  return {
    data: query.data,
    isLoading,
    error,
  }
}
