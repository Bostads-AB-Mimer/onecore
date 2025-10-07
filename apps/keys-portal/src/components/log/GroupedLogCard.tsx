import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Package, ChevronDown, ChevronUp } from 'lucide-react'
import { formatRelativeTime } from '@/lib/dateUtils'
import { eventTypeColors, objectTypeColors } from './constants'
import {
  LogEventTypeLabels,
  LogObjectTypeLabels,
  type GroupedLog,
} from '@/services/types'

export function GroupedLogCard({ groupedLog }: { groupedLog: GroupedLog }) {
  const [isOpen, setIsOpen] = useState(false)
  const { latestLog, logs, count, objectId } = groupedLog

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{latestLog.userName}</p>
                  <Badge variant="secondary" className="text-xs">
                    {count} händelser
                  </Badge>
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(latestLog.eventTime)}
                </time>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={eventTypeColors[latestLog.eventType]}
                >
                  {LogEventTypeLabels[latestLog.eventType]}
                </Badge>
                <Badge
                  variant="outline"
                  className={objectTypeColors[latestLog.objectType]}
                >
                  {LogObjectTypeLabels[latestLog.objectType]}
                </Badge>
              </div>

              {latestLog.description && (
                <p className="text-sm text-muted-foreground">
                  {latestLog.description}
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-2 font-mono">
                Objekt-ID: {objectId}
              </p>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-3 -ml-2">
                  {isOpen ? (
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

              <CollapsibleContent className="mt-4 space-y-3 pl-4 border-l-2 border-border">
                {logs.map((log) => (
                  <div key={log.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium">{log.userName}</p>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(log.eventTime)}
                      </time>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${eventTypeColors[log.eventType]}`}
                      >
                        {LogEventTypeLabels[log.eventType]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${objectTypeColors[log.objectType]}`}
                      >
                        {LogObjectTypeLabels[log.objectType]}
                      </Badge>
                    </div>

                    {log.description && (
                      <p className="text-xs text-muted-foreground">
                        {log.description}
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
