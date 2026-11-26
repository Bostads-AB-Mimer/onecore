import { Loader2 } from 'lucide-react'

import {
  isSurfaceComponent,
  useComponentEvents,
  useComponentInstance,
} from '@/entities/component'

import type { Component } from '@/services/types'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

import {
  getHistorySectionState,
  type HistoryRow,
} from '../lib/componentHistory'
import type { PlaceLabel } from '../lib/componentRows'

interface PlaceCellProps {
  place: PlaceLabel
}

const PlaceCell = ({ place }: PlaceCellProps) => (
  <span className="flex flex-col leading-snug">
    {place.address && <span>{place.address}</span>}
    <span className="text-muted-foreground">{place.detail}</span>
  </span>
)

interface HistoryTableProps {
  rows: HistoryRow[]
}

const HistoryTable = ({ rows }: HistoryTableProps) => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Händelse</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead>Källa</TableHead>
          <TableHead>Av</TableHead>
          <TableHead>Anteckning</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell>
              <div className="flex flex-wrap items-center gap-2">
                <span>{row.label}</span>
                {row.isCurrent && <Badge variant="default">Nuvarande</Badge>}
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">
              {row.dateLabel}
            </TableCell>
            <TableCell>
              {row.place ? (
                <PlaceCell place={row.place} />
              ) : (
                (row.source ?? '-')
              )}
            </TableCell>
            <TableCell>{row.actor ?? '-'}</TableCell>
            <TableCell>{row.note ?? '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)

interface ComponentHistorySectionProps {
  component: Component
}

export const ComponentHistorySection = ({
  component,
}: ComponentHistorySectionProps) => {
  const componentQuery = useComponentInstance(component.id)
  const eventsQuery = useComponentEvents(component.id)
  const state = getHistorySectionState(
    {
      component: componentQuery,
      fallbackInstallations: component.componentInstallations,
      events: eventsQuery,
    },
    { isSurface: isSurfaceComponent(component) }
  )

  const retry = () => {
    void componentQuery.refetch()
    void eventsQuery.refetch()
  }

  return (
    <div>
      <h3 className="font-semibold mb-3">Historik</h3>
      {state.status === 'loading' && (
        <div className="flex items-center justify-center py-4" role="status">
          <Loader2
            className="h-5 w-5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Hämtar historik</span>
        </div>
      )}
      {state.status === 'error' && (
        <div className="space-y-3">
          <div
            className="flex flex-col items-center gap-2 py-4 border rounded-md"
            role="alert"
          >
            <p className="text-sm text-destructive">
              Kunde inte hämta hela historiken.
            </p>
            <Button variant="outline" size="sm" onClick={retry}>
              Försök igen
            </Button>
          </div>
          {state.rows.length > 0 && <HistoryTable rows={state.rows} />}
        </div>
      )}
      {state.status === 'empty' && (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
          Ingen historik ännu
        </p>
      )}
      {state.status === 'ready' && <HistoryTable rows={state.rows} />}
    </div>
  )
}
