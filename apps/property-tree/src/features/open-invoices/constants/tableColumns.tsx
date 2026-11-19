import { getStatusBadge } from '@/entities/lease'
import { TenantNameLink } from '@/entities/tenant'

import type { OpenInvoiceReportRow } from '@/services/api/core/openInvoiceReportService'

import { formatSek } from '@/shared/lib/formatters'

export const INVOICE_STATE_LABELS: Record<
  OpenInvoiceReportRow['state'],
  string
> = {
  new: 'Ny',
  unmatched: 'Ej avprickad',
  overdue: 'Försenad',
  'partially-paid': 'Delvis betald',
  reminded: 'Påmind',
  deferred: 'Anstånd',
}

/** The name can be blank (protected identity, contacts failed); the contact
 * code is always shown. */
export const renderTenant = (row: OpenInvoiceReportRow) => (
  <TenantNameLink
    contactCode={row.contactCode}
    fullName={row.fullName}
    detail={row.fullName ? (row.contactCode ?? undefined) : undefined}
  />
)

// Days come as yyyy-mm-dd, already the Swedish format.
export const openInvoiceColumns = [
  {
    key: 'invoiceNumber',
    label: 'Fakturanummer',
    className: 'px-2',
    render: (row: OpenInvoiceReportRow) => (
      <span className="font-medium">{row.invoiceNumber}</span>
    ),
  },
  {
    key: 'invoiceDate',
    label: 'Fakturadatum',
    className: 'px-2',
    render: (row: OpenInvoiceReportRow) => row.invoiceDate ?? '-',
    hideOnMobile: true,
  },
  {
    key: 'dueDate',
    label: 'Förfallodatum',
    className: 'px-2',
    render: (row: OpenInvoiceReportRow) => row.dueDate ?? '-',
  },
  {
    key: 'daysPastDue',
    label: 'Dagar sen',
    className: 'px-2 text-right',
    render: (row: OpenInvoiceReportRow) => row.daysPastDue ?? '-',
    hideOnMobile: true,
  },
  {
    key: 'amount',
    label: 'Belopp',
    className: 'px-2 text-right',
    render: (row: OpenInvoiceReportRow) => formatSek(row.amount),
    hideOnMobile: true,
  },
  {
    key: 'remainingAmount',
    label: 'Skuld',
    className: 'px-2 text-right',
    render: (row: OpenInvoiceReportRow) => formatSek(row.remainingAmount),
  },
  {
    key: 'state',
    label: 'Fakturastatus',
    className: 'px-2',
    render: (row: OpenInvoiceReportRow) => INVOICE_STATE_LABELS[row.state],
    hideOnMobile: true,
  },
  {
    key: 'tenant',
    label: 'Hyresgäst',
    className: 'px-2',
    render: renderTenant,
  },
  {
    key: 'rentalObjectCode',
    label: 'Objektnummer',
    className: 'px-2',
    render: (row: OpenInvoiceReportRow) => row.rentalObjectCode ?? '-',
    hideOnMobile: true,
  },
  {
    key: 'address',
    label: 'Adress',
    className: 'px-2',
    render: (row: OpenInvoiceReportRow) => row.address || '-',
    hideOnMobile: true,
  },
  {
    key: 'leaseStatus',
    label: 'Kontraktsstatus',
    className: 'px-2',
    // Null when Tenfast has no such lease.
    render: (row: OpenInvoiceReportRow) =>
      row.leaseStatus === null ? '-' : getStatusBadge(row.leaseStatus),
    hideOnMobile: true,
  },
  {
    key: 'costCentre',
    label: 'Kostnadsställe',
    className: 'px-2',
    render: (row: OpenInvoiceReportRow) => row.costCentre ?? '-',
    hideOnMobile: true,
  },
]
