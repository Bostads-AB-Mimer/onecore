import { MiscellaneousInvoice } from '@onecore/types'
import { useQuery } from '@tanstack/react-query'

import { economyService } from '@/services/api/core/economyService'

export function useMiscellaneousInvoices() {
  const query = useQuery<MiscellaneousInvoice[], Error>({
    queryKey: ['miscellaneous-invoices'],
    queryFn: () => economyService.getMiscellaneousInvoices(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
