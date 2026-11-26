import { queryOptions } from '@tanstack/react-query'

import { authService } from '@/services/api/core/authService'

/** Users with the property-manager role (kvartersvärdar), shared by every page that lists them */
export const propertyManagersQueryOptions = queryOptions({
  queryKey: ['propertyManagers', 'property-manager'],
  queryFn: () => authService.getUsersByRole('property-manager'),
})
