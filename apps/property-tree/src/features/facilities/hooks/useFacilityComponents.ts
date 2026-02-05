import { useQuery } from '@tanstack/react-query'
import { componentService } from '@/services/api/core'

export const useFacilityComponents = (propertyObjectId: string) => {
  const componentsQuery = useQuery({
    queryKey: ['components', propertyObjectId],
    queryFn: () => componentService.getByRoomId(propertyObjectId),
  })

  return {
    components: componentsQuery.data ?? [],
    isLoading: componentsQuery.isLoading,
    error: componentsQuery.error,
  }
}
