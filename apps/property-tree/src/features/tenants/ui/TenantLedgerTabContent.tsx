import { parseAsString, useQueryState } from 'nuqs'

import { TabLayout } from '@/shared/ui/TabLayout'
import { InvoicesTable } from './InvoicesTable'
import { useTenantInvoices } from '../hooks/useTenantInvoices'

interface TenantLedgerTabContentProps {
  contactCode: string
}

export const TenantLedgerTabContent = ({
  contactCode,
}: TenantLedgerTabContentProps) => {
  const invoices = useTenantInvoices(contactCode)

  const [expandedInvoiceId, setExpandedInvoiceId] = useQueryState(
    'open',
    parseAsString
  )

  return (
    <TabLayout title="Fakturor" showCard={true} isLoading={invoices.isLoading}>
      {invoices.data && (
        <InvoicesTable
          onInvoiceRowClick={setExpandedInvoiceId}
          expandedInvoiceId={expandedInvoiceId}
          invoices={invoices.data}
        />
      )}
    </TabLayout>
  )
}
