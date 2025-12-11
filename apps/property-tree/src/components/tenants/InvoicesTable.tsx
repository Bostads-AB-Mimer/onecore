import { Badge } from '@/components/ui/v3/Badge'
import { parseISO } from 'date-fns'
import { Invoice, PaymentStatus, InvoicePaymentEvent } from '@onecore/types'
import { useInvoicePaymentEvents } from '@/components/hooks/useInvoicePaymentEvents'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import {
  CollapsibleTable,
  CollapsibleTableColumn,
} from '@/components/ui/CollapsibleTable'
import { Button } from '@/components/ui/v2/Button'
import { FileText } from 'lucide-react'

export const InvoicesTable = ({ invoices }: { invoices: Invoice[] }) => {
  // Sort invoices by invoice date, latest first
  const sortedInvoices = [...invoices].sort((a, b) => {
    const dateA =
      typeof a.invoiceDate === 'string'
        ? parseISO(a.invoiceDate)
        : a.invoiceDate
    const dateB =
      typeof b.invoiceDate === 'string'
        ? parseISO(b.invoiceDate)
        : b.invoiceDate
    return dateB.getTime() - dateA.getTime()
  })

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return numAmount.toFixed(2).replace('.', ',') + ' SEK'
  }

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-'
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toISOString().split('T')[0]
  }

  const formatSource = (source: string | undefined) => {
    if (!source) return '-'
    if (source.toLowerCase() === 'next') return 'XLedger'
    if (source.toLowerCase() === 'legacy') return 'Xpand'
    return source
  }

  // Extract deferment date from description like "Anstånd till 2025-12-31"
  const getDefermentDate = (description: string | undefined): Date | null => {
    if (!description) return null
    const match = description.match(/Anstånd till (\d{4}-\d{2}-\d{2})/)
    if (match && match[1]) {
      return new Date(match[1])
    }
    return null
  }

  // Get the effective expiration date (deferment date if applicable, otherwise original)
  const getEffectiveExpirationDate = (
    invoice: Invoice
  ): { date: Date | null; isDeferment: boolean; originalDate: Date | null } => {
    const originalDate = invoice.expirationDate
      ? typeof invoice.expirationDate === 'string'
        ? new Date(invoice.expirationDate)
        : invoice.expirationDate
      : null

    const defermentDate = getDefermentDate(invoice.description)

    if (defermentDate && originalDate && defermentDate > originalDate) {
      return { date: defermentDate, isDeferment: true, originalDate }
    }

    return { date: originalDate, isDeferment: false, originalDate: null }
  }

  const isInvoiceOverdue = (invoice: Invoice): boolean => {
    // If invoice is already paid, it's not overdue
    if (invoice.paymentStatus === PaymentStatus.Paid) {
      return false
    }

    // Get the effective expiration date (considering deferments)
    const { date } = getEffectiveExpirationDate(invoice)

    if (!date) {
      return false
    }

    const today = new Date()
    return today > date
  }

  const getStatusBadge = (invoice: Invoice): JSX.Element => {
    switch (invoice.paymentStatus) {
      case PaymentStatus.Paid:
        return <Badge variant={'success'}>Betald</Badge>
      case PaymentStatus.Unpaid:
        if (isInvoiceOverdue(invoice)) {
          return <Badge variant={'destructive'}>Förfallen</Badge>
        } else {
          return <Badge variant={'secondary'}>Obetald</Badge>
        }
      default:
        return <Badge variant={'secondary'}>Obetald</Badge>
    }
  }

  const getInvoiceType = (invoice: Invoice): string => {
    if (invoice.type === 'Other') return 'Ströfaktura'
    return 'Avi'
  }

  const handleOpenPDF = (url: string) => {
    window.open(url, '_blank')
  }

  // Check if a row is a contract header (rowType 3)
  const isContractHeader = (row: any): boolean => {
    return row?.rowType === 3
  }

  // Calculate subtotals for rows under each header
  const calculateSubtotals = (rows: any[]) => {
    const subtotals: Record<
      number,
      { amount: number; vat: number; total: number }
    > = {}

    for (let i = 0; i < rows.length; i++) {
      if (isContractHeader(rows[i])) {
        let amount = 0
        let vat = 0
        let total = 0

        // Sum up all rows until the next header or end
        for (let j = i + 1; j < rows.length; j++) {
          if (isContractHeader(rows[j])) break

          amount += rows[j].amount || 0
          vat += rows[j].vat || 0
          total += rows[j].totalAmount || 0
        }

        subtotals[i] = { amount, vat, total }
      }
    }

    return subtotals
  }

  // Component to render expiration date with deferment indicator
  const ExpirationDateCell = ({ invoice }: { invoice: Invoice }) => {
    const { date, isDeferment, originalDate } =
      getEffectiveExpirationDate(invoice)

    if (!date) return <span>-</span>

    if (isDeferment && originalDate) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{formatDate(date)}*</span>
          </TooltipTrigger>
          <TooltipContent>
            Ursprungligt förfallodatum: {formatDate(originalDate)}
          </TooltipContent>
        </Tooltip>
      )
    }

    return <span>{formatDate(date)}</span>
  }

  // Calculate payment date from payment events (when invoice was fully paid)
  const calculatePaymentDate = (
    events: InvoicePaymentEvent[] | undefined,
    invoiceAmount: number
  ): Date | null => {
    if (!events || events.length === 0) {
      console.log('calculatePaymentDate: No events')
      return null
    }

    // Sort events by payment date
    const sortedEvents = [...events].sort(
      (a, b) =>
        new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
    )

    console.log('calculatePaymentDate starting:', {
      invoiceAmount,
      eventsCount: sortedEvents.length,
      events: sortedEvents,
    })

    // Start with the invoice amount, then add negative payment events until we reach 0
    let remainingAmount = invoiceAmount
    for (const event of sortedEvents) {
      const eventAmount = Number(event.amount)
      remainingAmount += eventAmount
      console.log('After event:', {
        eventAmount: event.amount,
        eventAmountAsNumber: eventAmount,
        remainingAmount,
        paymentDate: event.paymentDate,
        reached: remainingAmount <= 0,
      })
      if (remainingAmount <= 0) {
        console.log('✅ Invoice fully paid on:', event.paymentDate)
        return new Date(event.paymentDate)
      }
    }

    console.log('❌ Invoice not fully paid. Final remaining:', remainingAmount)
    return null
  }

  // Component to display payment date for paid invoices
  const PaymentDateDisplay = ({
    events,
    invoiceAmount,
  }: {
    events: InvoicePaymentEvent[] | undefined
    invoiceAmount: number
  }) => {
    const paymentDate = calculatePaymentDate(events, invoiceAmount)

    if (!paymentDate) return <span>-</span>

    return <span>{formatDate(paymentDate)}</span>
  }

  // Component to display payment events table
  const InvoicePaymentEventsTable = ({
    events,
    isLoading,
    error,
  }: {
    events: InvoicePaymentEvent[] | undefined
    isLoading: boolean
    error: Error | null
  }) => {
    if (isLoading) {
      return (
        <div className="bg-background rounded-lg p-3 shadow-sm">
          <div className="font-medium text-sm mb-3 text-muted-foreground">
            Betalningshändelser
          </div>
          <div className="text-sm text-muted-foreground italic">
            Laddar betalningshändelser...
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="bg-background rounded-lg p-3 shadow-sm">
          <div className="font-medium text-sm mb-3 text-muted-foreground">
            Betalningshändelser
          </div>
          <div className="text-sm text-muted-foreground italic">
            Inga betalningshändelser hittades
          </div>
        </div>
      )
    }

    if (!events || events.length === 0) {
      return (
        <div className="bg-background rounded-lg p-3 shadow-sm">
          <div className="font-medium text-sm mb-3 text-muted-foreground">
            Betalningshändelser
          </div>
          <div className="text-sm text-muted-foreground italic">
            Inga betalningshändelser hittades
          </div>
        </div>
      )
    }

    return (
      <div className="bg-background rounded-lg p-3 shadow-sm">
        <div className="font-medium text-sm mb-3 text-muted-foreground">
          Betalningshändelser
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 text-xs font-medium">Källa</th>
              <th className="text-left p-2 text-xs font-medium">Belopp</th>
              <th className="text-left p-2 text-xs font-medium">Text</th>
              <th className="text-left p-2 text-xs font-medium">Betaldatum</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="p-2 text-sm">{event.transactionSourceCode}</td>
                <td className="p-2 text-sm">{formatCurrency(event.amount)}</td>
                <td className="p-2 text-sm">{event.text || '-'}</td>
                <td className="p-2 text-sm">{formatDate(event.paymentDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Component that wraps payment info and events for XLedger invoices
  const InvoiceDetailsWithPaymentInfo = ({ invoice }: { invoice: Invoice }) => {
    const {
      data: events,
      isLoading,
      error,
    } = useInvoicePaymentEvents(invoice.invoiceId)

    return (
      <>
        {invoice.paidAmount !== undefined && (
          <div className="mb-4 bg-success/5 rounded-lg p-4 border-l-4 border-success">
            <div className="grid grid-cols-3 gap-4 text-sm mb-3">
              <div>
                <span className="text-muted-foreground block mb-1">
                  Betaldatum:
                </span>
                <span className="font-semibold">
                  <PaymentDateDisplay
                    events={events}
                    invoiceAmount={invoice.amount}
                  />
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Källa:
                </span>
                <span className="font-semibold">
                  {formatSource(invoice.source)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">
                  Inbetalat belopp:
                </span>
                <span className="font-semibold text-success">
                  {formatCurrency(invoice.paidAmount)}
                </span>
              </div>
            </div>
          </div>
        )}
        <InvoicePaymentEventsTable
          events={events}
          isLoading={isLoading}
          error={error}
        />
      </>
    )
  }

  // Column definitions for CollapsibleTable
  const invoiceColumns: CollapsibleTableColumn<Invoice>[] = [
    {
      key: 'invoiceId',
      label: 'Fakturanummer',
      render: (invoice) => <span className="text-sm">{invoice.invoiceId}</span>,
      className: 'p-3 text-sm',
    },
    {
      key: 'invoiceDate',
      label: 'Fakturadatum',
      render: (invoice) => (
        <span className="text-sm">{formatDate(invoice.invoiceDate)}</span>
      ),
      className: 'p-3 text-sm',
    },
    {
      key: 'expirationDate',
      label: 'Förfallodatum',
      render: (invoice) => <ExpirationDateCell invoice={invoice} />,
      className: 'p-3 text-sm',
    },
    {
      key: 'amount',
      label: 'Belopp',
      render: (invoice) => (
        <span className="text-sm">{formatCurrency(invoice.amount)}</span>
      ),
      className: 'p-3 text-sm text-right',
    },
    {
      key: 'remainingAmount',
      label: 'Saldo',
      render: (invoice) => (
        <span className="text-sm">
          {formatCurrency(invoice.remainingAmount || 0)}
        </span>
      ),
      className: 'p-3 text-sm text-right',
    },
    {
      key: 'type',
      label: 'Fakturatyp',
      render: (invoice) => (
        <span className="text-sm">{getInvoiceType(invoice)}</span>
      ),
      className: 'p-3 text-sm',
    },
    {
      key: 'debtCollection',
      label: 'Inkasso',
      render: (invoice) => (
        <span className="text-sm">
          {invoice.sentToDebtCollection ? 'Ja' : 'Nej'}
        </span>
      ),
      className: 'p-3 text-sm',
    },
    {
      key: 'source',
      label: 'Källa',
      render: (invoice) => (
        <span className="text-sm">{formatSource(invoice.source)}</span>
      ),
      className: 'p-3 text-sm',
    },
    {
      key: 'status',
      label: 'Betalstatus',
      render: (invoice) => getStatusBadge(invoice),
      className: 'p-3 text-sm',
    },
  ]

  // Expanded content renderer
  const renderExpandedInvoiceContent = (invoice: Invoice) => {
    return (
      <>
        {invoice.description && (
          <div className="mb-3 text-sm bg-background/50 rounded p-2">
            <span className="font-medium">Text:</span> {invoice.description}
          </div>
        )}
        {invoice.invoiceFileUrl && (
          <div className="mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleOpenPDF(invoice.invoiceFileUrl!)
              }}
              className="w-full sm:w-auto"
            >
              <FileText className="h-4 w-4 mr-2" />
              Se PDF
            </Button>
          </div>
        )}
        {invoice.invoiceRows.length > 0 && (
          <div className="bg-background rounded-lg p-3 shadow-sm mb-4">
            <div className="font-medium text-sm mb-3 text-muted-foreground">
              Fakturarader
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 text-xs font-medium">Belopp</th>
                  <th className="text-left p-2 text-xs font-medium">Moms</th>
                  <th className="text-left p-2 text-xs font-medium">Totalt</th>
                  <th className="text-left p-2 text-xs font-medium">
                    Hyresartikel
                  </th>
                  <th className="text-left p-2 text-xs font-medium">
                    Beskrivning
                  </th>
                  <th className="text-left p-2 text-xs font-medium">
                    Utskriftsgrupp
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const subtotals = calculateSubtotals(invoice.invoiceRows)
                  return invoice.invoiceRows.map((item, idx) => {
                    const isHeader = isContractHeader(item)
                    const subtotal = isHeader ? subtotals[idx] : null

                    return (
                      <tr
                        key={idx}
                        className={`border-b last:border-0 ${isHeader ? 'bg-slate-100/70 font-semibold' : ''}`}
                      >
                        <td className="p-2 text-sm">
                          {isHeader && subtotal
                            ? formatCurrency(subtotal.amount)
                            : formatCurrency(item.amount)}
                        </td>
                        <td className="p-2 text-sm">
                          {isHeader && subtotal
                            ? formatCurrency(subtotal.vat)
                            : formatCurrency(item.vat)}
                        </td>
                        <td className="p-2 text-sm">
                          {isHeader && subtotal
                            ? formatCurrency(subtotal.total)
                            : formatCurrency(item.totalAmount)}
                        </td>
                        <td className="p-2 text-sm">
                          {isHeader ? 'Summa objekt:' : item.rentArticle}
                        </td>
                        <td className="p-2 text-sm">{item.invoiceRowText}</td>
                        <td className="p-2 text-sm">{item.printGroup}</td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        )}
        {invoice.source?.toLowerCase() === 'next' && (
          <InvoiceDetailsWithPaymentInfo invoice={invoice} />
        )}
      </>
    )
  }

  // Mobile summary renderer
  const renderInvoiceMobileSummary = (invoice: Invoice) => {
    return (
      <>
        <div className="flex items-start justify-between mb-2">
          <div className="space-y-1">
            <div className="font-medium">{invoice.invoiceId}</div>
            <div className="text-sm text-muted-foreground">
              {getInvoiceType(invoice)}
            </div>
          </div>
          {getStatusBadge(invoice)}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Belopp:</span>
            <span className="font-medium">
              {formatCurrency(invoice.amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Inkasso:</span>
            <span>{invoice.sentToDebtCollection ? 'Ja' : 'Nej'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Källa:</span>
            <span>{formatSource(invoice.source)}</span>
          </div>
        </div>
      </>
    )
  }

  return (
    <CollapsibleTable
      data={sortedInvoices}
      columns={invoiceColumns}
      keyExtractor={(invoice) => invoice.invoiceId}
      expandedContentRenderer={renderExpandedInvoiceContent}
      mobileCardConfig={{
        summaryRenderer: renderInvoiceMobileSummary,
      }}
      expansionConfig={{
        allowMultiple: false,
        chevronPosition: 'end',
        animated: true,
      }}
      emptyMessage="Inga fakturor hittades."
      className="rounded-lg border"
    />
  )
}
