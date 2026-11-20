import { useQuery } from '@tanstack/react-query'

import { cacheWarmingRetry } from '@/services/api/core/baseApi'
import { openInvoiceReportService } from '@/services/api/core/openInvoiceReportService'

/** Every open invoice of every tenant (restlista). */
export function useOpenInvoices() {
  return useQuery({
    queryKey: ['openInvoices'],
    queryFn: openInvoiceReportService.list,
    ...cacheWarmingRetry,
  })
}
