import React from 'react'
import { ExternalLink } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import { Badge } from '@/components/ui/v2/Badge'
import { WorkOrder } from '@/services/api/core/workOrderService'
import { Button } from '../ui/v2/Button'

interface WorkOrdersTableProps {
  orders: WorkOrder[]
}

export function WorkOrdersTable(props: WorkOrdersTableProps) {
  const [showAll, setShowAll] = React.useState(false)
  const dateFormatter = new Intl.DateTimeFormat('sv-SE')

  const orders = showAll ? props.orders : props.orders.slice(0, 5)

  return (
    <div className="max-h-96 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ärendenummer</TableHead>
            <TableHead>Ärende</TableHead>
            <TableHead>Skapat</TableHead>
            <TableHead>Förfaller</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Typ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) =>
            order._tag === 'internal' ? (
              <TableRow key={order.id}>
                <TableCell>{order.code}</TableCell>
                <TableCell>{order.caption}</TableCell>
                <TableCell>
                  {dateFormatter.format(new Date(order.registered))}
                </TableCell>
                <TableCell>
                  {order.dueDate
                    ? dateFormatter.format(new Date(order.dueDate))
                    : null}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{order.status}</Badge>
                </TableCell>
                <TableCell>
                  <a key={order.id} href={order.url} target="_blank">
                    <div className="flex items-center gap-2">
                      Odoo <ExternalLink size="18" />
                    </div>
                  </a>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow key={order.id} className="bg-gray-50">
                <TableCell>{order.id}</TableCell>
                <TableCell>{order.caption}</TableCell>
                <TableCell>
                  {dateFormatter.format(new Date(order.registered))}
                </TableCell>
                <TableCell>
                  {order.dueDate
                    ? dateFormatter.format(new Date(order.dueDate))
                    : null}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{order.status}</Badge>
                </TableCell>
                <TableCell>Xpand</TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
      <div className="flex justify-center">
        <Button
          onClick={() => setShowAll(!showAll)}
          variant="default"
          className="mt-4"
          size="sm"
        >
          {showAll ? 'Visa färre' : 'Visa alla'}
        </Button>
      </div>
    </div>
  )
}
