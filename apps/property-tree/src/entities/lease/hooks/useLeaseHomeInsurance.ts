import { useQuery } from '@tanstack/react-query'

import { homeInsuranceService } from '@/services/api/core/homeInsuranceService'

/** The lease's current home insurance row; data is null when it has none. */
export function useLeaseHomeInsurance(leaseId: string) {
  return useQuery({
    queryKey: ['leaseHomeInsurance', leaseId],
    queryFn: () => homeInsuranceService.getByLeaseId(leaseId),
  })
}
