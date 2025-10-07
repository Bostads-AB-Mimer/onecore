import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollText } from 'lucide-react'
import { formatRelativeTime } from '@/lib/dateUtils'
import { eventTypeColors, objectTypeColors } from './constants'
import {
  LogEventTypeLabels,
  LogObjectTypeLabels,
  type Log,
} from '@/services/types'

export function LogEventCard({ log }: { log: Log }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-primary" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium">{log.userName}</p>
              <time className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(log.eventTime)}
              </time>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              <Badge
                variant="outline"
                className={eventTypeColors[log.eventType]}
              >
                {LogEventTypeLabels[log.eventType]}
              </Badge>
              <Badge
                variant="outline"
                className={objectTypeColors[log.objectType]}
              >
                {LogObjectTypeLabels[log.objectType]}
              </Badge>
            </div>

            {log.description && (
              <p className="text-sm text-muted-foreground">{log.description}</p>
            )}

            {log.objectId && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                Objekt-ID: {log.objectId}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
