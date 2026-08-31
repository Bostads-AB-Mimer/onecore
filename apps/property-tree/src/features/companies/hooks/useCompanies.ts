import { useQuery } from '@tanstack/react-query'

import { companyService } from '@/services/api/core'

export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: () => companyService.getAll(),
  })
}
