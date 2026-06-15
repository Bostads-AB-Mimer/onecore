import { useQuery } from '@tanstack/react-query'

import { economyService } from '@/services/api/core'

export function useTenantInvoiceChannels(nationalRegistrationNumber: string) {
  const invoiceChannelsQuery = useQuery({
    queryKey: ['invoice-channels', nationalRegistrationNumber],
    queryFn: async () => {
      return await economyService.getInvoiceChannels(nationalRegistrationNumber)
    },
  })

  const isLoading = invoiceChannelsQuery.isLoading
  const error = invoiceChannelsQuery.error

  return {
    data: invoiceChannelsQuery.data,
    isLoading,
    error,
  }
}
