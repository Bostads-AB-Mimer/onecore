import { useQuery } from '@tanstack/react-query'

import { propertyService } from '@/services/api/core'
import { Company } from '@/services/types'

export const useProperties = (company: Company) => {
  return useQuery({
    queryKey: ['propertiesForCompany', company.id],
    queryFn: () => propertyService.getFromCompany(company),
  })
}
