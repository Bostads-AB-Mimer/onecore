import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'

import { useTenantInvoices } from '@/entities/tenant/hooks/useTenantInvoices'

import { paths } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import TableSkeleton from '@/shared/ui/TableSkeleton'

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
    <TabLayout title="Fakturor" showCard={true}>
      <Button asChild variant="outline" size="sm">
        <Link to={paths.economy({ contactCode })}>
          <Receipt className="h-4 w-4 mr-2" />
          Skapa ströfaktura
        </Link>
      </Button>
      {invoices.isLoading ? (
        <TableSkeleton />
      ) : (
        invoices.data && (
          <InvoicesTable
            onInvoiceRowClick={setExpandedInvoiceId}
            expandedInvoiceId={expandedInvoiceId}
            invoices={invoices.data}
          />
        )
      )}
    </TabLayout>
  )
}
