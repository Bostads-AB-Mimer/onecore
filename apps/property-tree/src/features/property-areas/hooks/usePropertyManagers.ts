import { useQuery } from '@tanstack/react-query'

import { propertyManagersQueryOptions } from '@/entities/user'

export function usePropertyManagers() {
  return useQuery(propertyManagersQueryOptions)
}
