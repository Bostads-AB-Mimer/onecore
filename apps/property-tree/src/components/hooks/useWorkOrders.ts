import { WorkOrder, workOrderService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

const useWorkOrders = (
  id: string,
  contextType: 'property' | 'tenant' | 'residence' | 'building'
) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])

  const getWorkOrdersFn = () => {
    switch (contextType) {
      case 'property':
        return workOrderService.getWorkOrderForProperty(id)
      case 'residence':
        return workOrderService.getWorkOrdersForResidence(id)
      case 'tenant':
        // TODO: Implement getWorkOrdersForTenant in workOrderService
        throw new Error('Work orders for tenant not yet implemented')
      case 'building':
        // TODO: Implement getWorkOrdersForBuilding in workOrderService
        throw new Error('Work orders for building not yet implemented')
    }
  }

  const workOrdersQuery = useQuery({
    queryKey: ['workOrders', contextType, id],
    queryFn: getWorkOrdersFn,
  })

  useEffect(() => {
    if (workOrdersQuery.data) {
      setWorkOrders(workOrdersQuery.data)
    }
  }, [workOrdersQuery.data])

  return {
    workOrders,
    isLoading: workOrdersQuery.isLoading,
    error: workOrdersQuery.error,
  }
}

export default useWorkOrders
