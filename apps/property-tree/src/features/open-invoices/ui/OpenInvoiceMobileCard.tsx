import type { OpenInvoiceReportRow } from '@/services/api/core/openInvoiceReportService'

import { formatSek } from '@/shared/lib/formatters'

import { INVOICE_STATE_LABELS, renderTenant } from '../constants/tableColumns'

export function OpenInvoiceMobileCard(row: OpenInvoiceReportRow) {
  return (
    <div className="space-y-2 w-full text-sm">
      <div className="flex justify-between items-start">
        <span className="font-medium">{row.invoiceNumber}</span>
        <span>{INVOICE_STATE_LABELS[row.state]}</span>
      </div>
      {renderTenant(row)}
      <div className="flex justify-between">
        <span>Förfaller {row.dueDate ?? '-'}</span>
        <span>{formatSek(row.remainingAmount)}</span>
      </div>
    </div>
  )
}
