import { workOrderService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'

const useWorkOrders = (
  id: string,
  contextType: 'property' | 'tenant' | 'residence' | 'building'
) => {
  const getWorkOrdersFn = () => {
    switch (contextType) {
      case 'property':
        return workOrderService.getWorkOrderForProperty(id)
      case 'residence':
        return workOrderService.getWorkOrdersForResidence(id)
      case 'tenant':
        // TODO: Implement getWorkOrdersForTenant in workOrderService
        return Promise.resolve([])
      case 'building':
        // TODO: Implement getWorkOrdersForBuilding in workOrderService
        return Promise.resolve([])
    }
  }

  // Only enable query for implemented context types
  const isImplemented = contextType === 'property' || contextType === 'residence'

  const workOrdersQuery = useQuery({
    queryKey: ['workOrders', contextType, id],
    queryFn: getWorkOrdersFn,
    enabled: isImplemented,
  })

  return {
    workOrders: workOrdersQuery.data ?? [],
    isLoading: workOrdersQuery.isLoading,
    error: workOrdersQuery.error,
  }
}

export default useWorkOrders
