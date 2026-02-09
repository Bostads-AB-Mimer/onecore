import { useQuery } from '@tanstack/react-query'
import { Company } from '@/services/types'
import { propertyService } from '@/services/api/core'

export const useProperties = (company: Company) => {
  return useQuery({
    queryKey: ['propertiesForCompanyId', company.id],
    queryFn: () => propertyService.getFromCompany(company),
  })
}
