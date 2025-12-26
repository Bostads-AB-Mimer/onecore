import { workOrderService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'

const useWorkOrders = (
  id: string,
  contextType:
    | 'property'
    | 'building'
    | 'residence'
    | 'tenant'
    | 'maintenanceUnit'
) => {
  const getWorkOrdersFn = () => {
    switch (contextType) {
      case 'property':
        // id = property id
        return workOrderService.getWorkOrderForProperty(id)
      case 'building':
        // id = building code
        return workOrderService.getWorkOrdersForBuilding(id)
      case 'residence':
        // id = rental object code
        return workOrderService.getWorkOrdersForResidence(id)
      case 'tenant':
        // id = contact code
        return workOrderService.getWorkOrdersByContactCode(id)
      case 'maintenanceUnit':
        // id = maintenance unit code
        return workOrderService.getWorkOrdersForMaintenanceUnit(id)
    }
  }

  // Only enable query for implemented context types
  const isImplemented =
    contextType === 'property' ||
    contextType === 'building' ||
    contextType === 'residence' ||
    contextType === 'tenant'

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
