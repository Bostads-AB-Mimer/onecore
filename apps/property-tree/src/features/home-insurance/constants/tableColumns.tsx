import { getStatusBadge } from '@/entities/lease'
import { TenantNameLink } from '@/entities/tenant'

import type { HomeInsuranceListItem } from '@/services/api/core/homeInsuranceService'

import { formatSek } from '@/shared/lib/formatters'

import { formatLfStatus } from '../lib/homeInsuranceFilters'
import { HomeInsuranceRowAction } from '../ui/HomeInsuranceRowAction'

/** Name and personnummer can be blank (protected identity, contacts failed). */
export const renderTenant = (row: HomeInsuranceListItem) => (
  <TenantNameLink
    contactCode={row.contactCode}
    fullName={row.fullName}
    detail={[row.nationalIdNumber, row.fullName && row.contactCode]
      .filter(Boolean)
      .join(' · ')}
  />
)

/** Added by the page only for staff with the write role. */
export const homeInsuranceActionColumn = {
  key: 'actions',
  label: '',
  className: 'px-2',
  render: (row: HomeInsuranceListItem) => <HomeInsuranceRowAction row={row} />,
}

export const homeInsuranceColumns = [
  {
    key: 'leaseId',
    label: 'Kontraktsnummer',
    className: 'px-2',
    sortKey: 'leaseId',
    render: (row: HomeInsuranceListItem) => (
      <span className="font-medium">{row.leaseId}</span>
    ),
  },
  {
    key: 'leaseStage',
    label: 'Kontraktsstatus',
    className: 'px-2',
    render: (row: HomeInsuranceListItem) => getStatusBadge(row.leaseStage),
    hideOnMobile: true,
  },
  {
    key: 'leaseStatus',
    label: 'LF-status',
    className: 'px-2',
    sortKey: 'leaseStatus',
    render: (row: HomeInsuranceListItem) => formatLfStatus(row.leaseStatus),
  },
  {
    key: 'rentalObjectCode',
    label: 'Objektnummer',
    className: 'px-2',
    sortKey: 'rentalObjectCode',
    render: (row: HomeInsuranceListItem) => row.rentalObjectCode || '-',
    hideOnMobile: true,
  },
  {
    key: 'address',
    label: 'Adress',
    className: 'px-2',
    sortKey: 'address',
    render: (row: HomeInsuranceListItem) => row.address || '-',
    hideOnMobile: true,
  },
  {
    key: 'tenant',
    label: 'Hyresgäst',
    className: 'px-2',
    render: renderTenant,
  },
  {
    key: 'contactInfo',
    label: 'Kontaktuppgifter',
    className: 'px-2',
    render: (row: HomeInsuranceListItem) =>
      row.email || row.phoneNumber ? (
        <div className="text-sm">
          {row.email && <div>{row.email}</div>}
          {row.phoneNumber && (
            <div className="text-muted-foreground">{row.phoneNumber}</div>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
    hideOnMobile: true,
  },
  {
    key: 'rowFromDate',
    label: 'Fr.o.m.',
    className: 'px-2',
    sortKey: 'rowFromDate',
    // Days come as yyyy-mm-dd, already the Swedish format.
    render: (row: HomeInsuranceListItem) => row.rowFromDate ?? '-',
  },
  {
    key: 'rowToDate',
    label: 'T.o.m.',
    className: 'px-2',
    sortKey: 'rowToDate',
    render: (row: HomeInsuranceListItem) => row.rowToDate ?? '-',
  },
  {
    key: 'monthlyAmount',
    label: 'Belopp/mån',
    className: 'px-2 text-right',
    sortKey: 'monthlyAmount',
    render: (row: HomeInsuranceListItem) => formatSek(row.monthlyAmount),
    hideOnMobile: true,
  },
]
