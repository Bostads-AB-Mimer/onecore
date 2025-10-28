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
  type Log,
} from '@/services/types'

interface BatchLogCardProps {
  logs: Log[]
}

export function BatchLogCard({ logs }: BatchLogCardProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (logs.length === 0) return null

  // Use the first log for summary information
  const firstLog = logs[0]
  const batchId = firstLog.batchId
  const count = logs.length

  // Get appropriate event type label and color (handles disposal special case)
  const isDisposal =
    firstLog.description?.toLowerCase().includes('kassera') ?? false

  const getEventTypeLabel = (log: Log): string => {
    if (log.eventType === 'update' && isDisposal) {
      return 'Kasserad'
    }

    return LogEventTypeLabels[log.eventType]
  }

  // Get appropriate color class for event type badge
  const getEventTypeColor = (): string => {
    // Disposal operations should use red/rose color (like delete)
    if (firstLog.eventType === 'update' && isDisposal) {
      return eventTypeColors['delete']
    }

    return eventTypeColors[firstLog.eventType]
  }

  // Determine batch description based on object type
  const getBatchDescription = () => {
    const objectType = firstLog.objectType
    const eventType = firstLog.eventType
    const objectLabel =
      LogObjectTypeLabels[objectType]?.toLowerCase() || 'objekt'

    const getPluralForm = (label: string, count: number) => {
      if (count === 1) return label

      // Special plural forms
      const pluralMap: Record<string, string> = {
        nyckel: 'nycklar',
        nyckelsystem: 'nyckelsystem', // same in plural
        nyckellån: 'nyckellån', // same in plural
        nyckelknippe: 'nyckelknippen',
        kvitto: 'kvitton',
        nyckelhändelse: 'nyckelhändelser',
        signatur: 'signaturer',
        nyckelanteckning: 'nyckelanteckningar',
      }

      return pluralMap[label] || label + 'ar'
    }

    const pluralLabel = getPluralForm(objectLabel, count)

    // Check if this is a disposal operation by looking at the description
    const isDisposal =
      firstLog.description?.toLowerCase().includes('kassera') ?? false

    if (eventType === 'creation') {
      return `Skapad batch: ${count} ${pluralLabel}`
    } else if (eventType === 'update') {
      // Special case: disposal operations show as "Kasserad" instead of "Uppdaterad"
      if (isDisposal) {
        return `Kasserad batch: ${count} ${pluralLabel}`
      }
      return `Uppdaterad batch: ${count} ${pluralLabel}`
    } else if (eventType === 'delete') {
      return `Raderad batch: ${count} ${pluralLabel}`
    }
    return `Batch: ${count} ${pluralLabel}`
  }

  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-primary/40">
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
                  <p className="text-sm font-medium">{firstLog.userName}</p>
                  <Badge variant="secondary" className="text-xs">
                    {count} st
                  </Badge>
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(firstLog.eventTime)}
                </time>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline" className={getEventTypeColor()}>
                  {getEventTypeLabel(firstLog)}
                </Badge>
                <Badge
                  variant="outline"
                  className={objectTypeColors[firstLog.objectType]}
                >
                  {LogObjectTypeLabels[firstLog.objectType]}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground font-medium">
                {getBatchDescription()}
              </p>

              <div className="mt-2 space-y-1">
                {firstLog.rentalObjectCode && (
                  <p className="text-xs text-muted-foreground">
                    Lägenhet: {firstLog.rentalObjectCode}
                  </p>
                )}
                {batchId && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Batch-ID: {batchId}
                  </p>
                )}
              </div>

              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-3 -ml-2">
                  {isOpen ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Dölj detaljer
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Visa alla {count} händelser
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-3 pl-4 border-l-2 border-border">
                {logs.map((log, index) => (
                  <div key={log.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium">
                        #{index + 1} - {log.userName}
                      </p>
                      <time className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(log.eventTime)}
                      </time>
                    </div>

                    {log.description && (
                      <p className="text-xs text-muted-foreground">
                        {log.description}
                      </p>
                    )}

                    <div className="space-y-0.5">
                      {log.objectId && (
                        <p className="text-xs text-muted-foreground font-mono">
                          Objekt-ID: {log.objectId}
                        </p>
                      )}
                      {log.rentalObjectCode && (
                        <p className="text-xs text-muted-foreground">
                          Lägenhet: {log.rentalObjectCode}
                        </p>
                      )}
                      {log.contactId && (
                        <p className="text-xs text-muted-foreground font-mono">
                          Kontakt-ID: {log.contactId}
                        </p>
                      )}
                    </div>
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
