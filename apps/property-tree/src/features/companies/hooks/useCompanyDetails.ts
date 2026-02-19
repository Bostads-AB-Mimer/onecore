import { useQuery } from '@tanstack/react-query'

import { companyService, propertyService } from '@/services/api/core'

export function useCompanyDetails(organizationNumber: string | undefined) {
  const companyQuery = useQuery({
    queryKey: ['company', organizationNumber],
    queryFn: () => companyService.getByOrganizationNumber(organizationNumber!),
    enabled: !!organizationNumber,
  })

  const propertiesQuery = useQuery({
    queryKey: ['properties', organizationNumber],
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
