import { Link } from 'react-router-dom'

import { formatDate, LeaseNumber, LeaseStatusBadge } from '@/entities/lease'

import type { LeaseSearchResult } from '@/services/api/core/leaseSearchService'

import { paths } from '@/shared/routes'
import { Checkbox } from '@/shared/ui/Checkbox'
import { ObjectTypeBadge } from '@/shared/ui/StatusBadges'

interface LeaseMobileCardProps {
  lease: LeaseSearchResult
  checked: boolean
  onToggle: () => void
}

export function LeaseMobileCard({
  lease,
  checked,
  onToggle,
}: LeaseMobileCardProps) {
  return (
    <div className="flex items-start gap-3 w-full">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="h-6 w-6 mt-0.5"
        aria-label={`Välj ${lease.leaseId}`}
      />
      <div className="space-y-3 flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-medium">
              <LeaseNumber externalUrl={lease.externalUrl}>
                {lease.leaseId}
              </LeaseNumber>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatDate(lease.startDate)} - {formatDate(lease.lastDebitDate)}
            </div>
          </div>
          <LeaseStatusBadge status={lease.status} />
        </div>
        <div className="space-y-2 text-sm">
          {lease.contacts && lease.contacts.length > 0 ? (
            lease.contacts.map((contact) => (
              <div key={contact.contactCode} className="flex justify-between">
                <span className="text-muted-foreground">Hyresgäst:</span>
                <Link
                  to={paths.tenant(contact.contactCode)}
                  className="font-medium text-primary hover:underline"
                >
                  {contact.name}
                </Link>
              </div>
            ))
          ) : (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hyresgäst:</span>
              <span className="text-muted-foreground">-</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Adress:</span>
            <span>{lease.address || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Objekttyp:</span>
            <ObjectTypeBadge type={lease.objectTypeCode} />
          </div>
        </div>
      </div>
    </div>
  )
}

interface LeaseMobileSelectAllProps {
  checked: boolean
  onToggle: () => void
  /** Number of leases matching the search, across all pages */
  totalCount: number
  /** Number of leases shown on this page */
  pageCount: number
}

// Phones render cards instead of the table, so the table header's
// "Välj alla" checkbox is not shown there.
export function LeaseMobileSelectAll({
  checked,
  onToggle,
  totalCount,
  pageCount,
}: LeaseMobileSelectAllProps) {
  return (
    <label className="flex items-center gap-3 min-h-[44px] mb-3 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="h-6 w-6"
      />
      <span>
        Välj alla {totalCount.toLocaleString('sv-SE')} träffar
        {totalCount > pageCount && (
          <span className="text-muted-foreground"> (även på andra sidor)</span>
        )}
      </span>
    </label>
  )
}
