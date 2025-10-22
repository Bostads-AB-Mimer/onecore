import { workOrderService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'

const useWorkOrders = (
  id: string,
  contextType: 'property' | 'building' | 'residence'
) => {
  const getWorkOrdersFn = () => {
    switch (contextType) {
      case 'property':
        return workOrderService.getWorkOrderForProperty(id)
      case 'building':
        return workOrderService.getWorkOrdersForBuilding(id) // id = building code
      case 'residence':
        return workOrderService.getWorkOrdersForResidence(id)
    }
  }

  // Only enable query for implemented context types
  const isImplemented =
    contextType === 'property' ||
    contextType === 'building' ||
    contextType === 'residence'

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
