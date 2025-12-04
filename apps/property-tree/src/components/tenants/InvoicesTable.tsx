import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v3/Badge'
import { Button } from '@/components/ui/v2/Button'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
//import type { Invoice } from '@/types/invoice'
import { useIsMobile } from '@/components/hooks/useMobile'
import { differenceInDays, parseISO } from 'date-fns'
import { Invoice, PaymentStatus, InvoicePaymentEvent } from '@onecore/types'
import { useInvoicePaymentEvents } from '@/components/hooks/useInvoicePaymentEvents'

export const InvoicesTable = ({ invoices }: { invoices: Invoice[] }) => {
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null)
  const isMobile = useIsMobile()

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

  const toggleExpand = (invoiceId: string) => {
    setExpandedInvoice(expandedInvoice === invoiceId ? null : invoiceId)
  }

  const isInvoiceOverdue = (invoice: Invoice): boolean => {
    // If invoice is already paid, it's not overdue
    if (invoice.paymentStatus === PaymentStatus.Paid) {
      return false
    }

    // Check if expirationDate exists and is in the past
    if (!invoice.expirationDate) {
      return false
    }

    const today = new Date()
    const dueDate =
      typeof invoice.expirationDate === 'string'
        ? parseISO(invoice.expirationDate)
        : invoice.expirationDate

    return today > dueDate
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

  const handleOpenPDF = (invoiceNumber: string) => {
    // TODO: Implement PDF opening logic
    console.log('Opening PDF for invoice:', invoiceNumber)
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

  // Component to display payment events for "next" system invoices
  const InvoicePaymentEvents = ({ invoiceId }: { invoiceId: string }) => {
    const { data, isLoading, error } = useInvoicePaymentEvents(invoiceId)

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

    if (!data || data.length === 0) {
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
            {data.map((event, idx) => (
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

  if (!invoices || invoices.length === 0) {
    return <div>Inga fakturor hittades.</div>
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {sortedInvoices.map((invoice) => {
          const isExpanded = expandedInvoice === invoice.invoiceId
          return (
            <Card key={invoice.invoiceId} className="overflow-hidden">
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleExpand(invoice.invoiceId)}
              >
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
                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="ml-1">Fakturarader</span>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t bg-muted/30 p-4">
                  {invoice.description && (
                    <div className="mb-3 text-sm">
                      <span className="font-medium">Text:</span>{' '}
                      {invoice.description}
                    </div>
                  )}
                  {invoice.paymentStatus === PaymentStatus.Paid &&
                    invoice.paidAmount !== undefined && (
                      <div className="mb-4 bg-success/5 rounded-lg p-4 border-l-4 border-success">
                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              Betaldatum:
                            </span>
                            <span className="font-semibold">
                              {/*invoice.paymentDate*/}
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
                        {/* <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenPDF(invoice.invoiceId)
                          }}
                          className="w-full sm:w-auto"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Öppna PDF
                        </Button> */}
                      </div>
                    )}
                  {invoice.invoiceRows.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {(() => {
                        const subtotals = calculateSubtotals(
                          invoice.invoiceRows
                        )
                        return invoice.invoiceRows.map((item, idx) => {
                          const isHeader = isContractHeader(item)

                          if (isHeader) {
                            const subtotal = subtotals[idx]
                            return (
                              <div key={idx}>
                                <div className="bg-muted/70 rounded-lg p-3 font-semibold text-sm">
                                  {item.invoiceRowText}
                                </div>
                                {subtotal && (
                                  <div className="bg-muted/30 rounded-lg p-3 text-sm mt-1">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Summa:
                                      </span>
                                      <span className="font-medium">
                                        {formatCurrency(subtotal.total)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          }

                          return (
                            <div
                              key={idx}
                              className="bg-background rounded-lg p-3 text-sm"
                            >
                              <div className="font-medium mb-1">
                                {item.invoiceRowText}
                              </div>
                              {item.rentArticle && (
                                <div className="text-muted-foreground text-xs mb-1">
                                  {item.rentArticle}
                                </div>
                              )}
                              <div className="flex justify-between mt-2">
                                <span className="text-muted-foreground">
                                  Belopp:
                                </span>
                                <span>{formatCurrency(item.amount)}</span>
                              </div>
                              {item.printGroup && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Grupp:
                                  </span>
                                  <span>{item.printGroup}</span>
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )}
                  {invoice.source?.toLowerCase() === 'next' && (
                    <InvoicePaymentEvents invoiceId={invoice.invoiceId} />
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 text-sm font-medium">Fakturanummer</th>
            <th className="text-left p-3 text-sm font-medium">Fakturadatum</th>
            <th className="text-left p-3 text-sm font-medium">Förfallodatum</th>
            <th className="text-right p-3 text-sm font-medium">Belopp</th>
            <th className="text-right p-3 text-sm font-medium">Saldo</th>
            <th className="text-left p-3 text-sm font-medium">Fakturatyp</th>
            <th className="text-left p-3 text-sm font-medium">Inkasso</th>
            <th className="text-left p-3 text-sm font-medium">Källa</th>
            <th className="text-left p-3 text-sm font-medium">Betalstatus</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {sortedInvoices.map((invoice) => {
            const isExpanded = expandedInvoice === invoice.invoiceId
            return (
              <>
                <tr
                  key={invoice.invoiceId}
                  className="border-b hover:bg-muted/30 cursor-pointer"
                  onClick={() => toggleExpand(invoice.invoiceId)}
                >
                  <td className="p-3 text-sm">{invoice.invoiceId}</td>
                  <td className="p-3 text-sm">
                    {formatDate(invoice.invoiceDate)}
                  </td>
                  <td className="p-3 text-sm">
                    {formatDate(invoice.expirationDate)}
                  </td>
                  <td className="p-3 text-sm text-right">
                    {formatCurrency(invoice.amount)}
                  </td>
                  <td className="p-3 text-sm text-right">
                    {formatCurrency(invoice.remainingAmount || 0)}
                  </td>
                  <td className="p-3 text-sm">{getInvoiceType(invoice)}</td>
                  <td className="p-3 text-sm">
                    {invoice.sentToDebtCollection ? 'Ja' : 'Nej'}
                  </td>
                  <td className="p-3 text-sm">
                    {formatSource(invoice.source)}
                  </td>
                  <td className="p-3 text-sm">{getStatusBadge(invoice)}</td>
                  <td className="p-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <div className="bg-muted/50 border-l-4 border-primary/30 p-4 ml-4">
                        {invoice.description && (
                          <div className="mb-3 text-sm bg-background/50 rounded p-2">
                            <span className="font-medium">Text:</span>{' '}
                            {invoice.description}
                          </div>
                        )}
                        {invoice.paymentStatus === PaymentStatus.Paid &&
                          invoice.paidAmount !== undefined && (
                            <div className="mb-4 bg-success/5 rounded-lg p-4 border-l-4 border-success">
                              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                                <div>
                                  <span className="text-muted-foreground block mb-1">
                                    Betaldatum:
                                  </span>
                                  <span className="font-semibold">
                                    {/*invoice.paymentDate*/}
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenPDF(invoice.invoiceId)
                                }}
                                className="w-full sm:w-auto"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Öppna PDF
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
                                  <th className="text-left p-2 text-xs font-medium">
                                    Belopp
                                  </th>
                                  <th className="text-left p-2 text-xs font-medium">
                                    Moms
                                  </th>
                                  <th className="text-left p-2 text-xs font-medium">
                                    Totalt
                                  </th>
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
                                  const subtotals = calculateSubtotals(
                                    invoice.invoiceRows
                                  )
                                  return invoice.invoiceRows.map(
                                    (item, idx) => {
                                      const isHeader = isContractHeader(item)
                                      const subtotal = isHeader
                                        ? subtotals[idx]
                                        : null

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
                                              : formatCurrency(
                                                  item.totalAmount
                                                )}
                                          </td>
                                          <td className="p-2 text-sm">
                                            {isHeader
                                              ? 'Summa objekt:'
                                              : item.rentArticle}
                                          </td>
                                          <td className="p-2 text-sm">
                                            {item.invoiceRowText}
                                          </td>
                                          <td className="p-2 text-sm">
                                            {item.printGroup}
                                          </td>
                                        </tr>
                                      )
                                    }
                                  )
                                })()}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {invoice.source?.toLowerCase() === 'next' && (
                          <InvoicePaymentEvents invoiceId={invoice.invoiceId} />
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
