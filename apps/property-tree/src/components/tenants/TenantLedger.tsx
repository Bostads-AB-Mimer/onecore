import { parseAsString, useQueryState } from 'nuqs'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { InvoicesTable } from './InvoicesTable'
import { useTenantInvoices } from '../hooks/useTenantInvoices'

interface TenantLedgerProps {
  contactCode: string
}

export const TenantLedger = ({ contactCode }: TenantLedgerProps) => {
  const invoices = useTenantInvoices(contactCode)

  const [expandedInvoiceId, setExpandedInvoiceId] = useQueryState(
    'open',
    parseAsString
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fakturor</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.isLoading && <p>Laddar fakturor...</p>}
          {invoices.data && (
            <InvoicesTable
              onInvoiceRowClick={setExpandedInvoiceId}
              expandedInvoiceId={expandedInvoiceId}
              invoices={invoices.data}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
