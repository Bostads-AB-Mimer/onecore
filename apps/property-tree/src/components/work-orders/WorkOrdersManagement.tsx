import { Button } from '@/components/ui/v2/Button'
import { WorkOrdersTable } from '@/components/work-orders/v2/WorkOrdersTable'
import { WorkOrdersTableSkeleton } from '@/components/work-orders/WorkOrdersTableSkeleton'
import { TabLayout } from '@/components/ui/TabLayout'
import { FilePlus } from 'lucide-react'
import useWorkOrders from '../hooks/useWorkOrders'
import { linkToOdooCreateMaintenanceRequest } from '@/utils/odooUtils'

export interface WorkOrdersManagementProps {
  id: string
  contextType?: 'property' | 'building' | 'residence' | 'tenant'
}

export function WorkOrdersManagement({
  id,
  contextType = 'residence',
}: WorkOrdersManagementProps) {
  // Fetch work orders based on context type and id
  const { workOrders, isLoading, error } = useWorkOrders(id, contextType)

  return (
    <TabLayout title="Ärenden" count={workOrders.length} showCard={true}>
      <div className="space-y-4">
        <div className="flex items-center justify-start">
          <Button
            size={'default'}
            variant={'default'}
            onClick={linkToOdooCreateMaintenanceRequest}
          >
            <FilePlus className="mr-2 h-4 w-4" />
            Skapa ärende
          </Button>
        </div>

        {error ? (
          <div className="text-red-500 p-4 border border-red-200 rounded-md bg-red-50">
            Kunde inte hämta ärendehistorik. Försök igen senare.
          </div>
        ) : isLoading ? (
          <WorkOrdersTableSkeleton />
        ) : workOrders.length > 0 ? (
          <WorkOrdersTable orders={workOrders} />
        ) : (
          <p className="text-slate-500 p-2">Ingen ärendehistorik.</p>
        )}
      </div>
    </TabLayout>
  )
}
