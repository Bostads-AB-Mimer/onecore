import { WorkOrder, workOrderService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

const useWorkOrders = (
  id: string,
  contextType: 'property' | 'tenant' | 'residence' | 'building'
) => {
  const [activeWorkOrders, setActiveWorkOrders] = useState<WorkOrder[]>([])
  const [historicalWorkOrders, setHistoricalWorkOrders] = useState<WorkOrder[]>(
    []
  )

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
      const active = workOrdersQuery.data.filter(
        (order) => order.status !== 'Avslutad'
      )
      const historical = workOrdersQuery.data.filter(
        (order) => order.status === 'Avslutad'
      )
      setActiveWorkOrders(active)
      setHistoricalWorkOrders(historical)
    }
  }, [workOrdersQuery.data])

  return {
    activeWorkOrders,
    historicalWorkOrders,
    isLoading: workOrdersQuery.isLoading,
    error: workOrdersQuery.error,
  }
}

export default useWorkOrders
