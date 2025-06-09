import { useQuery } from '@tanstack/react-query'
import { FilePlus } from 'lucide-react'

import { Grid } from '@/components/ui/Grid'
import {
  workOrderService,
  WorkOrder,
} from '@/services/api/core/workOrderService'
import { WorkOrdersTable } from '../work-orders/WorkOrdersTable'
import { Button } from '../ui/v2/Button'

interface ResidenceWorkOrdersProps {
  rentalId: string
}

const sortWorkOrders = (a: WorkOrder, b: WorkOrder) => {
  // TODO we should include the maintenance stage sequence in WorkOrder and sort by that
  const statusOrder = [
    'Påbörjad',
    'Väntar på handläggning',
    'Resurs tilldelad',
    'Väntar på beställda varor',
    'Utförd',
    'Avslutad',
  ]

  const statusA = statusOrder.indexOf(a.status)
  const statusB = statusOrder.indexOf(b.status)

  if (statusA < statusB) {
    return -1
  }

  if (statusA > statusB) {
    return 1
  }

  if (a.dueDate && b.dueDate) {
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  }

  return 0
}

export function ResidenceWorkOrders({ rentalId }: ResidenceWorkOrdersProps) {
  const workOrdersQuery = useQuery({
    queryKey: ['workOrders', rentalId],
    queryFn: () => workOrderService.getWorkOrdersForResidence(rentalId),
  })

  if (workOrdersQuery.isLoading) {
    return (
      <Grid cols={1}>
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </Grid>
    )
  }

  if (workOrdersQuery.error || !workOrdersQuery.data) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Kontrakt hittades inte
        </h2>
      </div>
    )
  }

  const workOrders = workOrdersQuery.data.sort(sortWorkOrders)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-start">
        <Button disabled size={'default'} variant={'default'}>
          <FilePlus className="mr-2 h-4 w-4" />
          Skapa ärende
        </Button>
      </div>

      {workOrders.length > 0 ? (
        <WorkOrdersTable orders={workOrdersQuery.data} />
      ) : (
        <p className="text-slate-500 p-2">Ingen ärendehistorik.</p>
      )}
    </div>
  )
}
