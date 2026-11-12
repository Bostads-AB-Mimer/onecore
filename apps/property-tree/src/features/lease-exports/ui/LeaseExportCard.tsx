import { Check, Download, Loader2 } from 'lucide-react'

import {
  downloadLeaseExport,
  leaseExportFailureText,
  leaseExportLabel,
} from '@/entities/lease'

import type { LeaseExport } from '@/services/api/core/leaseExportService'

import { formatFileSize } from '@/shared/lib/fileUtils'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

const PHASES = [
  { phase: 'fetching-leases', label: 'Hämtar kontrakt' },
  { phase: 'fetching-contacts', label: 'Hämtar kontaktuppgifter' },
  { phase: 'building-file', label: 'Skapar fil' },
  { phase: 'saving-file', label: 'Sparar fil' },
  { phase: null, label: 'Klar' },
] as const

const PILL = 'px-2.5 py-0.5'

function formatShortDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

function formatDateTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${formatShortDate(iso)} ${time}`
}

function formatSize(bytes: number): string {
  return formatFileSize(bytes).replace('.', ',')
}

export function LeaseExportCard({ leaseExport }: { leaseExport: LeaseExport }) {
  const label = leaseExportLabel(leaseExport)
  const started = formatDateTime(leaseExport.startedAt)

  if (leaseExport.status === 'running') {
    const currentIndex = Math.max(
      0,
      PHASES.findIndex((p) => p.phase === leaseExport.phase)
    )
    const count =
      leaseExport.leaseCount === null
        ? ''
        : `${leaseExport.leaseCount.toLocaleString('sv-SE')} kontrakt · `

    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {count}startade {started}
            </p>
          </div>
          <Badge variant="secondary" className={PILL}>
            Pågår
          </Badge>
        </div>
        <ul className="mt-3 flex flex-col text-sm">
          {PHASES.map((p, i) => {
            const state =
              i < currentIndex
                ? 'done'
                : i === currentIndex
                  ? 'current'
                  : 'todo'
            return (
              <li
                key={p.label}
                className={cn(
                  'relative flex items-center gap-2.5 py-1.5',
                  state === 'current' && 'font-medium',
                  state === 'todo' && 'text-muted-foreground opacity-70'
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 flex-none items-center justify-center rounded-full',
                    state === 'done' && 'bg-success text-success-foreground',
                    state === 'todo' && 'border-2 border-border'
                  )}
                >
                  {state === 'done' && <Check className="h-2.5 w-2.5" />}
                  {state === 'current' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </span>
                {p.label}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  if (leaseExport.status === 'failed') {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{started}</p>
          </div>
          <Badge variant="destructive" className={PILL}>
            Misslyckades
          </Badge>
        </div>
        <p className="mt-2 text-sm text-destructive">
          Misslyckades: {leaseExportFailureText(leaseExport.failureReason)}
        </p>
      </div>
    )
  }

  const details = [
    formatDateTime(leaseExport.finishedAt ?? leaseExport.startedAt),
    leaseExport.sizeBytes === null ? null : formatSize(leaseExport.sizeBytes),
    leaseExport.expiresAt === null
      ? null
      : `raderas ${formatShortDate(leaseExport.expiresAt)}`,
  ].filter((part) => part !== null)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-semibold">
            {leaseExport.fileName ?? label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        <Badge variant="success" className={PILL}>
          Klar
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {details.join(' · ')}
      </p>
      <Button
        variant="outline"
        className="mt-3"
        onClick={() => void downloadLeaseExport(leaseExport.id)}
      >
        <Download className="mr-2 h-4 w-4" />
        Ladda ned
      </Button>
    </div>
  )
}
