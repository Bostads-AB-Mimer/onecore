import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import { WorkOrder } from '@/services/api/core'
import { useState } from 'react'

interface WorkOrdersTableProps {
  orders: WorkOrder[]
}

export function WorkOrdersTable({ orders }: WorkOrdersTableProps) {
  const [showAll, setShowAll] = useState(false)
  const displayedOrders = showAll ? orders : orders.slice(0, 5)
  const hasMoreOrders = orders.length > 5

  const getStatusBadge = (status: WorkOrder['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Pågående
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            Väntande
          </Badge>
        )
      case 'resolved':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800">
            Åtgärdat
          </Badge>
        )
      default:
        return null
    }
  }

  const handleOpenOrder = (orderId: string) => {
    // Här kan du lägga till navigering eller modal för att visa ärendedetaljer
  }

  return (
    <div className="space-y-4">
      <ResponsiveTable
        data={displayedOrders}
        columns={[
          {
            key: 'id',
            label: 'Ärendenummer',
            render: (order) => <span className="font-medium">{order.id}</span>,
          },
          {
            key: 'title',
            label: 'Ärende',
            render: (order) => order.title,
          },
          {
            key: 'reportedDate',
            label: 'Skapad datum',
            render: (order) => order.reportedDate,
            hideOnMobile: true,
          },
          {
            key: 'dueDate',
            label: 'Förfallodatum',
            render: (order) => order.dueDate || '-',
            hideOnMobile: true,
          },
          {
            key: 'status',
            label: 'Status',
            render: (order) => getStatusBadge(order.status),
          },
          {
            key: 'type',
            label: 'Typ',
            render: (order) => order.type || '-',
            hideOnMobile: true,
          },
          {
            key: 'action',
            label: 'Åtgärd',
            render: (order) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenOrder(order.id)}
              >
                Öppna
              </Button>
            ),
          },
        ]}
        keyExtractor={(order) => order.id}
        mobileCardRenderer={(order) => (
          <div className="space-y-2 w-full">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{order.id}</div>
                <div className="text-sm">{order.title}</div>
              </div>
              {getStatusBadge(order.status)}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenOrder(order.id)}
              >
                Öppna
              </Button>
            </div>
          </div>
        )}
      />

      {hasMoreOrders && !showAll && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            Se fler ({orders.length - 5} till)
          </Button>
        </div>
      )}

      {showAll && hasMoreOrders && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShowAll(false)}>
            Visa färre
          </Button>
        </div>
      )}
    </div>
  )
}
