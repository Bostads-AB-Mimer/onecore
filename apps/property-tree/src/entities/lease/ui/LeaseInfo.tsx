import { Calendar } from 'lucide-react'

import type { Lease } from '@/services/api/core/leaseService'

import { formatDate } from '../lib/formatting'

interface LeaseInfoProps {
  lease: Pick<Lease, 'leaseId' | 'leaseStartDate'> &
    Partial<Pick<Lease, 'lastDebitDate' | 'preferredMoveOutDate' | 'rentRows'>>
}

const getLeaseRent = (rentRows: Lease['rentRows']) => {
  if (!rentRows || rentRows.length === 0) return null

  const now = new Date()
  const activeRows = rentRows.filter(
    (row) =>
      (!row.from || new Date(row.from) <= now) &&
      (!row.to || new Date(row.to) >= now)
  )
  if (activeRows.length === 0) return null

  return activeRows.reduce((sum, row) => sum + row.amount, 0)
}

export function LeaseInfo({ lease }: LeaseInfoProps) {
  const leaseRent = getLeaseRent(lease.rentRows)

  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Kontraktsnummer</p>
          <p className="font-medium">{lease.leaseId}</p>
        </div>
        {leaseRent !== null && (
          <div>
            <p className="text-sm text-muted-foreground">Hyra för kontrakt</p>
            <p className="font-medium">
              {`${Math.round(leaseRent).toLocaleString('sv-SE')} kr/mån`}
            </p>
          </div>
        )}
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
