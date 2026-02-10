import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { WorkOrder } from '@/services/api/core'
import { linkToWorkOrderInOdoo } from '@/shared/lib/odooUtils'
import { useState } from 'react'

interface WorkOrdersTableProps {
  orders: WorkOrder[]
}

const INITIAL_DISPLAY_COUNT = 5

export function WorkOrdersTable({ orders }: WorkOrdersTableProps) {
  const [showAll, setShowAll] = useState(false)
  const displayedOrders = showAll
    ? orders
    : orders.slice(0, INITIAL_DISPLAY_COUNT)
  const hasMoreOrders = orders.length > INITIAL_DISPLAY_COUNT

  const dateFormatter = new Intl.DateTimeFormat('sv-SE')

  const getStatusBadge = (status: WorkOrder['status']) => {
    switch (status) {
      case 'Resurs tilldelad':
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Pågående
          </Badge>
        )
      case 'Påbörjad':
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Påbörjad
          </Badge>
        )
      case 'Väntar på handläggning':
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            Väntande
          </Badge>
        )
      case 'Avslutad':
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-800">
            Åtgärdat
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <ResponsiveTable
        data={displayedOrders}
        columns={[
          {
            key: 'id',
            label: 'Ärendenummer',
            render: (order: WorkOrder) => (
              <span className="font-medium">{order.code}</span>
            ),
          },
          {
            key: 'title',
            label: 'Ärende',
            render: (order: WorkOrder) => order.caption,
          },
          {
            key: 'reportedDate',
            label: 'Skapad datum',
            render: (order: WorkOrder) =>
              order.registered
                ? dateFormatter.format(new Date(order.registered))
                : '-',
            hideOnMobile: true,
          },
          {
            key: 'dueDate',
            label: 'Förfallodatum',
            render: (order: WorkOrder) =>
              order.dueDate
                ? dateFormatter.format(new Date(order.dueDate))
                : '-',
            hideOnMobile: true,
          },
          {
            key: 'status',
            label: 'Status',
            render: (order: WorkOrder) => getStatusBadge(order.status),
          },
          {
            key: 'type',
            label: 'Typ',
            render: (order: WorkOrder) =>
              order._tag === 'internal' ? 'Odoo' : 'Xpand',
            hideOnMobile: true,
          },
          {
            key: 'action',
            label: 'Åtgärd',
            render: (order: WorkOrder) =>
              order._tag === 'internal' &&
              order.code && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => linkToWorkOrderInOdoo(order)}
                >
                  Öppna
                </Button>
              ),
          },
        ]}
        keyExtractor={(order) => order.id}
        mobileCardRenderer={(order: WorkOrder) => (
          <div className="space-y-2 w-full">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{order.code}</div>
                <div className="text-sm">{order.caption}</div>
              </div>
              {getStatusBadge(order.status)}
            </div>
            <div className="flex justify-end">
              {order._tag === 'internal' && order.code && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => linkToWorkOrderInOdoo(order)}
                >
                  Öppna
                </Button>
              )}
            </div>
          </div>
        )}
      />

      {hasMoreOrders && !showAll && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            Se fler ({orders.length - INITIAL_DISPLAY_COUNT} till)
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
