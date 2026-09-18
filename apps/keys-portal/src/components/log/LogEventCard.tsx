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
import { formatAbsoluteTime } from '@/lib/dateUtils'
import { eventTypeColors, objectTypeColors } from './constants'
import { type Log } from '@/services/types'
import { logService } from '@/services/api/logService'

const DESCRIPTION_PREVIEW_LENGTH = 300

// Bulk-operation summaries put their detail list after a newline — show only the first line collapsed
function ExpandableDescription({
  text,
  className = 'text-sm',
}: {
  text: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const newlineIndex = text.indexOf('\n')
  const previewEnd =
    newlineIndex !== -1 ? newlineIndex : DESCRIPTION_PREVIEW_LENGTH
  if (text.length <= previewEnd) {
    return <p className={`${className} text-muted-foreground`}>{text}</p>
  }
  return (
    <p
      className={`${className} text-muted-foreground break-words whitespace-pre-line`}
    >
      {expanded ? text : `${text.slice(0, previewEnd)}…`}{' '}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="underline hover:text-foreground"
      >
        {expanded ? 'Visa mindre' : 'Visa mer'}
      </button>
    </p>
  )
}

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
                  {formatAbsoluteTime(log.eventTime)}
                </time>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={eventTypeColors[log.eventType]}
                >
                  {log.eventTypeLabel}
                </Badge>
                <Badge
                  variant="outline"
                  className={objectTypeColors[log.objectType]}
                >
                  {log.objectTypeLabel}
                </Badge>
              </div>

              {log.description && (
                <ExpandableDescription text={log.description} />
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
                        {formatAbsoluteTime(eventLog.eventTime)}
                      </time>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${eventTypeColors[eventLog.eventType]}`}
                      >
                        {eventLog.eventTypeLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${objectTypeColors[eventLog.objectType]}`}
                      >
                        {eventLog.objectTypeLabel}
                      </Badge>
                    </div>

                    {eventLog.description && (
                      <ExpandableDescription
                        text={eventLog.description}
                        className="text-xs"
                      />
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
