import { workOrderService } from '@/services/api/core'
import { ContextType } from '@/types/ui'
import { useQuery } from '@tanstack/react-query'

export const useWorkOrders = (id: string, contextType: ContextType) => {
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
    contextType === 'tenant' ||
    contextType === 'maintenanceUnit'

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
