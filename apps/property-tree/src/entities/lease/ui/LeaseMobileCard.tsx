import type { ReactNode } from 'react'

import type { Lease } from '@/services/api/core/leaseService'

import { Button } from '@/shared/ui/Button'

import { formatDate } from '../lib/formatting'
import { LeaseStatusBadge } from './LeaseStatusBadge'

interface LeaseMobileCardProps {
  lease: Pick<
    Lease,
    'leaseNumber' | 'leaseStartDate' | 'lastDebitDate' | 'status'
  >
  title?: string
  children?: ReactNode
}

export function LeaseMobileCard({
  lease,
  title,
  children,
}: LeaseMobileCardProps) {
  return (
    <div className="space-y-3 w-full">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm font-medium">
            {title ?? `Kontrakt ${lease.leaseNumber}`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatDate(lease.leaseStartDate)}
            {lease.lastDebitDate && ` - ${formatDate(lease.lastDebitDate)}`}
          </div>
        </div>
        <LeaseStatusBadge status={lease.status} />
      </div>

      {children}

      <div className="flex justify-end pt-2 border-t">
        <Button variant="outline" size="sm" disabled>
          Visa kontrakt
        </Button>
      </div>
    </div>
  )
}
