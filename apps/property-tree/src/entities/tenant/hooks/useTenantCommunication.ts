import { useQuery } from '@tanstack/react-query'

import { communicationService } from '@/services/api/core/communicationService'

export function useTenantCommunication(contactCode: string | undefined) {
  const communicationQuery = useQuery({
    queryKey: ['tenant-communication', contactCode],
    queryFn: () => communicationService.getCustomerMessages(contactCode!),
    enabled: !!contactCode,
  })

  return {
    data: communicationQuery.data,
    isLoading: communicationQuery.isLoading,
    error: communicationQuery.error,
  }
}
