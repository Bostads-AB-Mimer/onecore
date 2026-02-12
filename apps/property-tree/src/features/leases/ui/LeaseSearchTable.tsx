import { Link } from 'react-router-dom'

import { formatDate, LeaseStatusBadge } from '@/entities/lease'

import type { LeaseSearchResult } from '@/services/api/core/leaseSearchService'

import { ObjectTypeBadge } from '@/shared/ui/StatusBadges'

export function LeaseMobileCard(lease: LeaseSearchResult) {
  return (
    <div className="space-y-3 w-full">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm font-medium">{lease.leaseId}</div>
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
                to={`/tenants/${contact.contactCode}`}
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
  )
}
