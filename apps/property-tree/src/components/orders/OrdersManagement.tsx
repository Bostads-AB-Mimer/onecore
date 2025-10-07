import { Button } from '@/components/ui/v2/Button'
import { OrderCard } from '@/components/orders/OrderCard'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { TabLayout } from '@/components/ui/TabLayout'
import { FilePlus } from 'lucide-react'
import { workOrderService } from '@/services/api/core'
import { useQuery } from '@tanstack/react-query'
import usePropertyWorkOrders from '../hooks/usePropertyWorkOrders'

export interface OrdersManagementProps {
  contextType?: 'tenant' | 'residence' | 'building'
  residenceId?: string
  tenant?: any // Adding the missing tenant prop
}

export function OrdersManagement({
  contextType = 'residence',
  residenceId,
  tenant,
}: OrdersManagementProps) {
  const { id } = useParams<{ id: string }>()
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch work orders for the residence using hook
  const { activeWorkOrders, historicalWorkOrders } = usePropertyWorkOrders()

  const handleOrderCreated = () => {
    // Force a re-render to show the new order
    setRefreshKey((prev) => prev + 1)
  }

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
            onClick={() => console.log('Create order clicked')} // Placeholder action)}
          >
            <FilePlus className="mr-2 h-4 w-4" />
            Skapa ärende
          </Button>
        </div>

        <Tabs defaultValue="active" className="space-y-6" key={refreshKey}>
          <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
            <TabsTrigger value="active">Aktiva ärenden</TabsTrigger>
            <TabsTrigger value="history">Ärendehistorik</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeWorkOrders.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {activeWorkOrders.map((orderItem) => (
                  <OrderCard key={orderItem.id} orderItem={orderItem} />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 p-2">Inga aktiva ärenden.</p>
            )}
          </TabsContent>

          <TabsContent value="history">
            {historicalWorkOrders.length > 0 ? (
              <OrdersTable orders={historicalWorkOrders} />
            ) : (
              <p className="text-slate-500 p-2">Ingen ärendehistorik.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TabLayout>
  )
}
