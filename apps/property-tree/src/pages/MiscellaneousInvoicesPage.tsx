import { MiscellaneousInvoice } from '@onecore/types'

import { useMiscellaneousInvoices } from '@/features/economy/hooks/useMiscellaneousInvoices'

import { formatCurrency, formatDate } from '@/entities/lease'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { ViewLayout } from '@/shared/ui/layout'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

const columns = [
  {
    key: 'invoiceDate',
    label: 'Fakturadatum',
    render: (invoice: MiscellaneousInvoice) => formatDate(invoice.invoiceDate),
  },
  {
    key: 'leaseId',
    label: 'Hyresobjekt',
    render: (invoice: MiscellaneousInvoice) => invoice.leaseId || '-',
  },
  {
    key: 'reference',
    label: 'Referens',
    render: (invoice: MiscellaneousInvoice) => invoice.reference,
    hideOnMobile: true,
  },
  {
    key: 'ourReference',
    label: 'Vår referens',
    render: (invoice: MiscellaneousInvoice) => invoice.ourReference,
    hideOnMobile: true,
  },
  {
    key: 'description',
    label: 'Beskrivning',
    render: (invoice: MiscellaneousInvoice) => invoice.description || '-',
  },
  {
    key: 'amount',
    label: 'Belopp',
    render: (invoice: MiscellaneousInvoice) => formatCurrency(invoice.amount),
    className: 'text-right',
  },
]

export function MiscellaneousInvoicesPage() {
  const { data: invoices, isLoading, error } = useMiscellaneousInvoices()

  return (
    <ViewLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Ströfakturor</h1>
        <p className="text-muted-foreground">
          Översikt av skapade ströfakturor
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alla ströfakturor</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar ströfakturor...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Ett fel uppstod vid hämtning av ströfakturor
            </div>
          ) : (
            <ResponsiveTable
              data={invoices}
              columns={columns}
              keyExtractor={(invoice) => invoice.invoiceId}
              emptyMessage="Inga ströfakturor hittades"
            />
          )}
        </CardContent>
      </Card>
    </ViewLayout>
  )
}
