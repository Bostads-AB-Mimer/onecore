import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { cacheWarmingRetry } from '@/services/api/core/baseApi'
import {
  type HomeInsuranceListQueryParams,
  homeInsuranceService,
} from '@/services/api/core/homeInsuranceService'

export function useHomeInsurances(
  params: HomeInsuranceListQueryParams,
  page: number,
  limit: number
) {
  return useQuery({
    queryKey: ['homeInsurances', params, page, limit],
    queryFn: () => homeInsuranceService.list(params, page, limit),
    placeholderData: keepPreviousData,
    ...cacheWarmingRetry,
  })
}
