import { useQuery } from '@tanstack/react-query'

import { companyService, propertyService } from '@/services/api/core'

export function useCompanyDetails(companyId: string | undefined) {
  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companyService.getById(companyId!),
    enabled: !!companyId,
  })

  const propertiesQuery = useQuery({
    queryKey: ['properties', companyId],
    queryFn: () => propertyService.getFromCompany(companyQuery.data!),
    enabled: !!companyQuery.data,
  })

  return {
    company: companyQuery.data,
    properties: propertiesQuery.data,
    isLoading: companyQuery.isLoading || propertiesQuery.isLoading,
    error: companyQuery.error || propertiesQuery.error,
  }
}
