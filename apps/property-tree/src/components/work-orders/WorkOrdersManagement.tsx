import { Button } from '@/components/ui/v2/Button'
import { WorkOrderCard } from '@/components/work-orders/WorkOrderCard'
import { WorkOrderCardSkeleton } from '@/components/work-orders/WorkOrderCardSkeleton'
import { WorkOrdersTable } from '@/components/work-orders/v2/WorkOrdersTable'
import { WorkOrdersTableSkeleton } from '@/components/work-orders/WorkOrdersTableSkeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { TabLayout } from '@/components/ui/TabLayout'
import { FilePlus } from 'lucide-react'
import useWorkOrders from '../hooks/useWorkOrders'

export interface WorkOrdersManagementProps {
  id: string
  contextType?: 'property' | 'tenant' | 'residence' | 'building'
  tenant?: any // Adding the missing tenant prop
}

export function WorkOrdersManagement({
  id,
  contextType = 'residence',
  tenant,
}: WorkOrdersManagementProps) {
  // Fetch work orders based on context type and id
  const { activeWorkOrders, historicalWorkOrders, isLoading, error } =
    useWorkOrders(id, contextType)

  return (
    <TabLayout
      title="Ärenden"
      count={activeWorkOrders.length + historicalWorkOrders.length}
      showCard={true}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-start">
          <Button
            disabled
            size={'default'}
            variant={'default'}
            onClick={() => {}} // Placeholder action)}
          >
            <FilePlus className="mr-2 h-4 w-4" />
            Skapa ärende
          </Button>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
            <TabsTrigger value="active">Aktiva ärenden</TabsTrigger>
            <TabsTrigger value="history">Ärendehistorik</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <WorkOrderCardSkeleton key={i} />
                ))}
              </div>
            ) : activeWorkOrders.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {activeWorkOrders.map((orderItem) => (
                  <WorkOrderCard key={orderItem.id} orderItem={orderItem} />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 p-2">Inga aktiva ärenden.</p>
            )}
          </TabsContent>

          <TabsContent value="history">
            {isLoading ? (
              <WorkOrdersTableSkeleton />
            ) : historicalWorkOrders.length > 0 ? (
              <WorkOrdersTable orders={historicalWorkOrders} />
            ) : (
              <p className="text-slate-500 p-2">Ingen ärendehistorik.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TabLayout>
  )
}
