import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollText, ChevronDown, ChevronUp } from 'lucide-react'
import { formatRelativeTime } from '@/lib/dateUtils'
import { eventTypeColors, objectTypeColors } from './constants'
import {
  LogEventTypeLabels,
  LogObjectTypeLabels,
  type Log,
} from '@/services/types'
import { logService } from '@/services/api/logService'

export function LogEventCard({ log }: { log: Log }) {
  const [isOpen, setIsOpen] = useState(false)
  const [allLogs, setAllLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpenChange = async (open: boolean) => {
    if (open && log.objectId && allLogs.length === 0) {
      setLoading(true)
      try {
        const logs = await logService.fetchLogsByObjectId(log.objectId)
        setAllLogs(logs)
      } catch (error) {
        console.error('Failed to fetch logs for objectId:', error)
      } finally {
        setLoading(false)
      }
    }
    setIsOpen(open)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
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
                <p className="text-sm text-muted-foreground">
                  {log.description}
                </p>
              )}

              {log.objectId && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground font-mono">
                    Objekt-ID: {log.objectId}
                  </p>
                </div>
              )}

              {log.objectId && (
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 -ml-2"
                    disabled={loading}
                  >
                    {loading ? (
                      'Laddar...'
                    ) : isOpen ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Dölj alla händelser
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Visa alla händelser
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}

              <CollapsibleContent className="mt-4 space-y-3 pl-4 border-l-2 border-border">
                {allLogs.map((eventLog) => (
                  <div key={eventLog.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium">{eventLog.userName}</p>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(eventLog.eventTime)}
                      </time>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${eventTypeColors[eventLog.eventType]}`}
                      >
                        {LogEventTypeLabels[eventLog.eventType]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${objectTypeColors[eventLog.objectType]}`}
                      >
                        {LogObjectTypeLabels[eventLog.objectType]}
                      </Badge>
                    </div>

                    {eventLog.description && (
                      <p className="text-xs text-muted-foreground">
                        {eventLog.description}
                      </p>
                    )}
                  </div>
                ))}
              </CollapsibleContent>
            </div>
          </div>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
