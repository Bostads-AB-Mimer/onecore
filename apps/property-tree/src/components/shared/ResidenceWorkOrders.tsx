import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Grid } from '@/components/ui/Grid'
import {
  workOrderService,
  WorkOrder,
} from '@/services/api/core/workOrderService'

interface ResidenceWorkOrdersProps {
  rentalId: string
}

const sortByStatus = (a: WorkOrder, b: WorkOrder) => {
  // TODO we should include the maintenance stage sequence in WorkOrder and sort by that
  const statusOrder = [
    'Väntar på handläggning',
    'Resurs tilldelad',
    'Påbörjad',
    'Väntar på beställda varor',
    'Utförd',
    'Avslutad',
  ]

  const statusA = statusOrder.indexOf(a.Status)
  const statusB = statusOrder.indexOf(b.Status)

  if (statusA < statusB) {
    return -1
  }
  if (statusA > statusB) {
    return 1
  }
  return 0
}

const sortyByRegistered = (a: WorkOrder, b: WorkOrder) => {
  const dateA = new Date(a.Registered)
  const dateB = new Date(b.Registered)

  if (dateA < dateB) {
    return -1
  }
  if (dateA > dateB) {
    return 1
  }
  return 0
}

export function ResidenceWorkOrders({ rentalId }: ResidenceWorkOrdersProps) {
  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['workOrders', rentalId],
    queryFn: () => workOrderService.getWorkOrdersForResidence(rentalId),
  })

  if (isLoading) {
    return (
      <Card title="Ärenden">
        <Grid cols={2}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
            />
          ))}
        </Grid>
      </Card>
    )
  }

  return (
    <Card title="Ärenden">
      <Grid cols={2}>
        {workOrders
          ?.sort(sortyByRegistered)
          .sort(sortByStatus)
          .map((workOrder) => (
            <a key={workOrder.Id} href={workOrder.Url} target="_blank">
              <Card>
                <p>{workOrder.Code}</p>
                <p className="font-bold">{workOrder.Caption}</p>
                <p>{new Date(workOrder.Registered).toLocaleString()}</p>
                <p>{workOrder.Status}</p>
              </Card>
            </a>
          ))}
      </Grid>
    </Card>
  )
}
