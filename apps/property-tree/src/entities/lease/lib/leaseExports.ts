import type { LeaseExport } from '@/services/api/core/leaseExportService'

import { leaseStatusOptions } from './leaseStatusOptions'

export const leaseExportPhases = [
  { phase: 'fetching-leases', label: 'Hämtar kontrakt' },
  { phase: 'fetching-contacts', label: 'Hämtar kontaktuppgifter' },
  { phase: 'building-file', label: 'Skapar fil' },
  { phase: 'saving-file', label: 'Sparar fil' },
] as const satisfies ReadonlyArray<{
  phase: NonNullable<LeaseExport['phase']>
  label: string
}>

export function leaseExportPhaseLabel(phase: LeaseExport['phase']): string {
  return leaseExportPhases.find((p) => p.phase === phase)?.label ?? 'Exporterar'
}

type ExportWithStatus = Pick<LeaseExport, 'id' | 'status'>

export function findSettledExports<T extends ExportWithStatus>(
  prev: T[] | undefined,
  next: T[]
): { finished: T[]; failed: T[] } {
  if (!prev) return { finished: [], failed: [] }

  const previouslyRunning = new Set(
    prev.filter((e) => e.status === 'running').map((e) => e.id)
  )
  const wasRunning = (e: T) => previouslyRunning.has(e.id)

  return {
    finished: next.filter((e) => e.status === 'done' && wasRunning(e)),
    failed: next.filter((e) => e.status === 'failed' && wasRunning(e)),
  }
}

export function leaseExportLabel(
  leaseExport: Pick<LeaseExport, 'statusFilter'>
): string {
  const names = leaseExport.statusFilter.flatMap((value) => {
    const option = leaseStatusOptions.find((o) => o.value === value)
    return option ? [option.label] : []
  })

  return `Hyreskontrakt · ${names.length > 0 ? names.join(', ') : 'Alla'}`
}

export function leaseExportFailureText(
  reason: LeaseExport['failureReason']
): string {
  return reason === 'lease-service-warming-up'
    ? 'Systemet startar upp, försök igen om en stund.'
    : 'Exporten kunde inte skapas.'
}
