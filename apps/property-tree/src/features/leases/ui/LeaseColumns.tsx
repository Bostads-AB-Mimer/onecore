import { Link } from 'react-router-dom'

import { formatDate, LeaseStatusBadge } from '@/entities/lease'

import type { LeaseSearchResult } from '@/services/api/core/leaseSearchService'

import { paths } from '@/shared/routes'
import { ObjectTypeBadge } from '@/shared/ui/StatusBadges'

export const leaseColumns = [
  {
    key: 'leaseId',
    label: 'Kontraktsnummer',
    className: 'px-2',
    render: (lease: LeaseSearchResult) => (
      <span className="font-medium">{lease.leaseId}</span>
    ),
  },
  {
    key: 'contacts',
    label: 'Hyresgäst',
    className: 'px-2',
    render: (lease: LeaseSearchResult) => {
      if (!lease.contacts || lease.contacts.length === 0) {
        return <span className="text-muted-foreground">-</span>
      }
      return (
        <div className="space-y-1">
          {lease.contacts.map((contact) => (
            <div key={contact.contactCode}>
              <Link
                to={paths.tenant(contact.contactCode)}
                className="font-medium text-primary hover:underline"
              >
                {contact.name}
              </Link>
              <div className="text-sm text-muted-foreground">
                {contact.contactCode}
              </div>
            </div>
          ))}
        </div>
      )
    },
  },
  {
    key: 'contactInfo',
    label: 'Kontaktuppgifter',
    className: 'px-2',
    render: (lease: LeaseSearchResult) => {
      if (!lease.contacts || lease.contacts.length === 0) {
        return <span className="text-muted-foreground">-</span>
      }
      return (
        <div className="space-y-2">
          {lease.contacts.map((contact) => (
            <div key={contact.contactCode}>
              {contact.email && <div className="text-sm">{contact.email}</div>}
              {contact.phone && (
                <div className="text-sm text-muted-foreground">
                  {contact.phone}
                </div>
              )}
              {!contact.email && !contact.phone && (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          ))}
        </div>
      )
    },
    hideOnMobile: true,
  },
  {
    key: 'objectType',
    label: 'Objekttyp',
    className: 'px-2',
    render: (lease: LeaseSearchResult) => (
      <ObjectTypeBadge type={lease.objectTypeCode} />
    ),
    hideOnMobile: true,
  },
  {
    key: 'address',
    label: 'Adress',
    className: 'px-2',
    render: (lease: LeaseSearchResult) => lease.address || '-',
    hideOnMobile: true,
  },
  {
    key: 'startDate',
    label: 'Startdatum',
    className: 'px-2',
    render: (lease: LeaseSearchResult) => formatDate(lease.startDate),
    hideOnMobile: true,
  },
  {
    key: 'lastDebitDate',
    label: 'Slutdatum',
    className: 'px-2',
    render: (lease: LeaseSearchResult) => formatDate(lease.lastDebitDate),
  },
  {
    key: 'status',
    label: 'Status',
    className: 'px-2',
    render: (lease: LeaseSearchResult) => (
      <LeaseStatusBadge status={lease.status} />
    ),
    hideOnMobile: true,
  },
]
