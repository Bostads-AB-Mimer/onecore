import { Calendar } from 'lucide-react'

import type { Lease } from '@/services/api/core/leaseService'

import { formatDate } from '../lib/formatting'

interface LeaseInfoProps {
  lease: Pick<Lease, 'leaseId' | 'leaseStartDate'> &
    Partial<Pick<Lease, 'lastDebitDate' | 'preferredMoveOutDate'>>
}

export function LeaseInfo({ lease }: LeaseInfoProps) {
  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Kontraktsnummer</p>
          <p className="font-medium">{lease.leaseId}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Inflyttningsdatum</p>
          <div className="flex items-center gap-2">
            <p className="font-medium">{formatDate(lease.leaseStartDate)}</p>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {lease.lastDebitDate && (
          <div>
            <p className="text-sm text-muted-foreground">Utflyttningsdatum</p>
            <div className="flex items-center gap-2">
              <p className="font-medium">{formatDate(lease.lastDebitDate)}</p>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}
        {lease.preferredMoveOutDate && (
          <div>
            <p className="text-sm text-muted-foreground">
              Önskat avflyttningsdatum
            </p>
            <div className="flex items-center gap-2">
              <p className="font-medium">
                {formatDate(lease.preferredMoveOutDate)}
              </p>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
