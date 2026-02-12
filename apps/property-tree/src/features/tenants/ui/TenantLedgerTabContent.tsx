import { parseAsString, useQueryState } from 'nuqs'

import { TabLayout } from '@/shared/ui/layout/TabLayout'

import { useTenantInvoices } from '../hooks/useTenantInvoices'
import { InvoicesTable } from './InvoicesTable'

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
