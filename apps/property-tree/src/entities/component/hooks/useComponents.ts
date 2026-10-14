import { useQueries, useQuery } from '@tanstack/react-query'

import { componentService } from '@/services/api/core'

const componentsQuery = (propertyObjectId: string) => ({
  queryKey: ['components', propertyObjectId],
  queryFn: () => componentService.getByRoomId(propertyObjectId),
})

export function useComponents(propertyObjectId: string) {
  const query = useQuery(componentsQuery(propertyObjectId))

  return {
    components: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}

export function useComponentsBySpace(propertyObjectIds: string[]) {
  return useQueries({
    queries: propertyObjectIds.map(componentsQuery),
    combine: (results) =>
      new Map(
        propertyObjectIds.flatMap((id, i) => {
          const data = results[i]?.data
          return data ? [[id, data] as const] : []
        })
      ),
  })
}
