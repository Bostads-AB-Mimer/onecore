import { useState } from 'react'
import { MiscellaneousInvoice } from '@onecore/types'
import { ExternalLink } from 'lucide-react'

import { useMiscellaneousInvoices } from '@/features/economy/hooks/useMiscellaneousInvoices'

import { formatCurrency, formatDate } from '@/entities/lease'

import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { DateRangeFilterDropdown, FilterBar } from '@/shared/ui/filters'
import { ViewLayout } from '@/shared/ui/layout'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

const columns = [
  {
    key: 'invoiceDate',
    label: 'Fakturadatum',
    render: (invoice: MiscellaneousInvoice) => formatDate(invoice.invoiceDate),
  },
  {
    key: 'invoiceId',
    label: 'Fakturanummer',
    render: (invoice: MiscellaneousInvoice) => invoice.invoiceId,
    hideOnMobile: true,
  },
  {
    key: 'reference',
    label: 'Kund',
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

function expandableContent(invoice: MiscellaneousInvoice) {
  const hasItems = !!invoice.invoiceBaseItems?.length
  const hasFile = !!invoice.invoiceFileUrl
  if (!hasItems && !hasFile) return null

  return (
    <div className="space-y-3">
      {hasItems && (
        <div>
          <h4 className="text-sm font-medium mb-2">Fakturarader</h4>
          <div className="space-y-1">
            {invoice.invoiceBaseItems!.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  {item.text}
                  <span className="text-muted-foreground">
                    {' '}
                    (Antal: {item.quantity}, à-pris:{' '}
                    {formatCurrency(item.unitPrice)})
                  </span>
                </span>
                <span className="font-medium">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasFile && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={invoice.invoiceFileUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Öppna faktura
          </a>
        </Button>
      )}
    </div>
  )
}

export function MiscellaneousInvoicesPage() {
  const [fromDate, setFromDate] = useState<string | null>(null)
  const [toDate, setToDate] = useState<string | null>(null)

  const {
    data: invoices,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMiscellaneousInvoices({
    from: fromDate ?? undefined,
    to: toDate ?? undefined,
  })

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
          <FilterBar>
            <DateRangeFilterDropdown
              startDate={fromDate}
              endDate={toDate}
              onDateChange={(start, end) => {
                setFromDate(start)
                setToDate(end)
              }}
              placeholder="Filtrera på fakturadatum..."
            />
          </FilterBar>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Laddar ströfakturor...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Ett fel uppstod vid hämtning av ströfakturor
            </div>
          ) : (
            <>
              <ResponsiveTable
                data={invoices}
                columns={columns}
                keyExtractor={(invoice) => invoice.invoiceId}
                emptyMessage="Inga ströfakturor hittades"
                expandableContent={expandableContent}
              />
              {hasNextPage && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? 'Laddar...' : 'Visa fler'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </ViewLayout>
  )
}
