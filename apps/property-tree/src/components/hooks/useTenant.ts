//TODO: Handle the case where contact is not a tenant in the original call, not fallback

import { useQuery } from '@tanstack/react-query'
import { tenantService } from '@/services/api/core'
import type { Tenant } from '@/services/types'

export function useTenant(contactCode: string | undefined) {
  const tenantQuery = useQuery({
    queryKey: ['tenant', contactCode],
    queryFn: async () => {
      try {
        // Try to get tenant data first (requires active/upcoming contracts)
        return await tenantService.getByContactCode(contactCode!)
      } catch {
        // Fallback: Get contact data instead (works even without contracts)
        const contact = await tenantService.getContactByContactCode(
          contactCode!
        )

        // Map Contact to Tenant structure with empty contracts
        return {
          ...contact,
          currentHousingContract: undefined,
          upcomingHousingContract: undefined,
          parkingSpaceContracts: [],
          housingContracts: [],
          isAboutToLeave: false,
          isTenant: false,
        } as Tenant
      }
    },
    enabled: !!contactCode,
  })

  const isLoading = tenantQuery.isLoading
  const error = tenantQuery.error

  return {
    data: tenantQuery.data,
    isLoading,
    error,
  }
}
