import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v2/Badge'
import { WorkOrder } from '@/services/api/core'

type WorkOrderCardProps = {
  orderItem: WorkOrder
}

export function WorkOrderCard({ orderItem }: WorkOrderCardProps) {
  const getPriorityVariant = (
    priority: string
  ): 'priority-low' | 'priority-medium' | 'priority-high' => {
    switch (priority) {
      case 'low':
        return 'priority-low'
      case 'medium':
        return 'priority-medium'
      case 'high':
        return 'priority-high'
      default:
        return 'priority-medium'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <CardTitle className="text-base font-medium">
              {orderItem.caption}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              ID: {orderItem.id}
            </span>
          </div>
          {orderItem.priority && (
            <Badge
              variant={getPriorityVariant(orderItem.priority ?? 'default')}
            >
              {orderItem.priority === 'low'
                ? 'Låg'
                : orderItem.priority === 'medium'
                  ? 'Medium'
                  : 'Hög'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm mb-2">{orderItem.status}</div>
        <div className="text-xs text-muted-foreground">
          <div>Rapporterad: {orderItem.registered}</div>
          <div>Tilldelad: {'-'}</div>
          {orderItem.dueDate && (
            <div>Planerat utförande: {orderItem.dueDate}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
