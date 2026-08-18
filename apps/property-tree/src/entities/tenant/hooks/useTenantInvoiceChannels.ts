import { economy } from '@onecore/types'
import { useQuery } from '@tanstack/react-query'

import { economyService } from '@/services/api/core'

export function useTenantInvoiceChannels(recipient: economy.LookupRecipient) {
  const invoiceChannelsQuery = useQuery({
    queryKey: ['invoice-channels', recipient.recipientId],
    queryFn: async () => {
      return await economyService.getInvoiceChannels(recipient)
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
