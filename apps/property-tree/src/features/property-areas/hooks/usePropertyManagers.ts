import { useQuery } from '@tanstack/react-query'

import { authService } from '@/services/api/core'

export function usePropertyManagers() {
  return useQuery({
    queryKey: ['propertyManagers', 'property-manager'],
    queryFn: () => authService.getUsersByRole('property-manager'),
  })
}
