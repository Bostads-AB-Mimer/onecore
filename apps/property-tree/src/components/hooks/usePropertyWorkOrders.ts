import { WorkOrder, workOrderService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

const usePropertyWorkOrders = () => {
  // Placeholder for actual hook logic
  const [activeWorkOrders, setActiveWorkOrders] = useState<WorkOrder[]>([])
  const [historicalWorkOrders, setHistoricalWorkOrders] = useState<WorkOrder[]>(
    []
  )

  const workOrdersQuery = useQuery({
    queryKey: ['workOrders', '501-001-01-0103'],
    queryFn: () =>
      workOrderService.getWorkOrdersForResidence('501-001-01-0103'),
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

  return { activeWorkOrders, historicalWorkOrders }
}

export default usePropertyWorkOrders
