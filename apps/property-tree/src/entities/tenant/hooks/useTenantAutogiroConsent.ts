import { useQuery } from '@tanstack/react-query'

import { economyService } from '@/services/api/core'

export function useTenantAutogiroConsent(nationalRegistrationNumber: string) {
  const autogiroConsentQuery = useQuery({
    queryKey: ['autogiro-consent', nationalRegistrationNumber],
    queryFn: async () => {
      return await economyService.getAutogiroConsent(nationalRegistrationNumber)
    },
    enabled: !!nationalRegistrationNumber,
  })

  const isLoading = autogiroConsentQuery.isLoading
  const error = autogiroConsentQuery.error

  return {
    data: autogiroConsentQuery.data,
    isLoading,
    error,
  }
}
