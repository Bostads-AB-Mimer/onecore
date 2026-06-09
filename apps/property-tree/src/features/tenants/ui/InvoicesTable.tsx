import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Invoice, InvoicePaymentEvent, PaymentStatus } from '@onecore/types'
import { format, parseISO, startOfToday } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CalendarIcon, FileText } from 'lucide-react'
import { match, P } from 'ts-pattern'
import { z } from 'zod'

import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Calendar } from '@/shared/ui/Calendar'
import {
  CollapsibleTable,
  CollapsibleTableColumn,
} from '@/shared/ui/CollapsibleTable'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/Dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/Form'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'
import { Textarea } from '@/shared/ui/Textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/Tooltip'

import { useInvoicePaymentEvents } from '../hooks/useInvoicePaymentEvents'
import type { DeferralError } from '../hooks/useUpdateInvoiceDeferral'
import { useUpdateInvoiceDeferral } from '../hooks/useUpdateInvoiceDeferral'

const currencyFormatter = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  currencyDisplay: 'code',
  maximumFractionDigits: 2,
})

const paymentEventTypeLabels: Record<string, string> = {
  INVOICE: 'Faktura',
  CREDIT_MEMO: 'Kredit',
  ELECTRONIC_PAYMENT: 'Inbetalning',
  PAYMENT: 'Inbetalning',
  REMINDER: 'Påminnelse',
}

const formatPaymentEventType = (slTransactionType: string | null) => {
  if (!slTransactionType) return '-'
  return paymentEventTypeLabels[slTransactionType] ?? slTransactionType
}

type Props = {
  invoices: Invoice[]
  onInvoiceRowClick: (invoiceId: string | null) => void
  expandedInvoiceId: string | null
  contactCode?: string
}

const deferralFormSchema = z.object({
  endDate: z.date({ required_error: 'Välj ett förfallodatum' }),
  reason: z.string().min(1, 'Ange en anledning'),
})

type DeferralFormValues = z.infer<typeof deferralFormSchema>

const deferralErrorMessages: Record<DeferralError['code'], string> = {
  'invoice-not-found': 'Fakturan hittades inte i Tenfast.',
  'xledger-failed':
    'Anståndet registrerades i Tenfast men misslyckades i Xledger. Ekonomiteamet har notifierats.',
  'tenfast-failed':
    'Anståndet kunde inte registreras i Tenfast. Ekonomiteamet har notifierats.',
}

const GrantDeferralDialog = ({
  invoice,
  contactCode,
}: {
  invoice: Invoice
  contactCode: string
}) => {
  const [open, setOpen] = useState(false)
  const updateDeferral = useUpdateInvoiceDeferral()

  const form = useForm<DeferralFormValues>({
    resolver: zodResolver(deferralFormSchema),
    defaultValues: { reason: '' },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      form.reset()
      updateDeferral.reset()
    }
  }

  const onSubmit = (values: DeferralFormValues) => {
    updateDeferral.mutate(
      {
        invoiceId: invoice.invoiceId,
        contactCode,
        endDate: format(values.endDate, 'yyyy-MM-dd'),
        reason: values.reason,
      },
      { onSuccess: () => handleOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => e.stopPropagation()}
        >
          Bevilja anstånd
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Bevilja anstånd</DialogTitle>
          <DialogDescription>
            Faktura {invoice.invoiceId} – ange nytt förfallodatum. Anståndet
            registreras i Tenfast och förs sedan över till Xledger.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-2"
          >
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Nytt förfallodatum</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(field.value, 'd MMMM yyyy', { locale: sv })
                            : 'Välj datum'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < startOfToday()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anledning</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="T.ex. betalningsplan överenskommen med hyresgäst."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {updateDeferral.error && (
              <p className="text-sm text-destructive">
                {deferralErrorMessages[updateDeferral.error.code] ??
                  'Något gick fel.'}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={updateDeferral.isPending}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={updateDeferral.isPending}>
                {updateDeferral.isPending ? 'Sparar...' : 'Spara'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export const InvoicesTable = (props: Props) => {
  // Sort invoices by invoice date, latest first
  const sortedInvoices = [...props.invoices].sort((a, b) => {
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

  const formatCurrency = (amount: number) => {
    return currencyFormatter.format(amount)
  }

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-'
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return format(dateObj, 'yyyy-MM-dd')
  }

  const formatSource = (source: Invoice['source']) => {
    return match(source)
      .with('next', () => 'XLedger')
      .with('legacy', () => 'Xpand')
      .exhaustive()
  }

  // Get the effective expiration date (deferment date if applicable, otherwise original)
  const getEffectiveExpirationDate = (
    invoice: Invoice
  ): { date: Date | null; isDeferment: boolean; originalDate: Date | null } => {
    const originalDate = invoice.expirationDate
      ? new Date(invoice.expirationDate)
      : null

    const defermentDate = invoice.defermentDate
      ? new Date(invoice.defermentDate)
      : null

    if (defermentDate && originalDate && defermentDate > originalDate) {
      return { date: defermentDate, isDeferment: true, originalDate }
    }

    return { date: originalDate, isDeferment: false, originalDate: null }
  }

  const getStatusBadge = (invoice: Invoice) => {
    return match(invoice)
      .with({ credit: { originalInvoiceId: P.string } }, () => (
        <Badge variant="secondary">Kredit</Badge>
      ))
      .with({ paymentStatus: PaymentStatus.Paid }, () => (
        <Badge variant="success">Betald</Badge>
      ))
      .with({ paymentStatus: PaymentStatus.PartlyPaid }, () => (
        <Badge variant="priority-medium">Delvis betald</Badge>
      ))
      .with({ paymentStatus: PaymentStatus.Unpaid }, () => (
        <Badge variant="secondary">Obetald</Badge>
      ))
      .with({ paymentStatus: PaymentStatus.Overdue }, () => (
        <Badge variant="destructive">Förfallen</Badge>
      ))
      .otherwise((v) => (
        <Badge variant="secondary">Okänd betalstatus: {v.paymentStatus}</Badge>
      ))
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

  // TODO(AL): Move to backend
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
              <th className="text-left p-2 text-xs font-medium">Typ</th>
              <th className="text-left p-2 text-xs font-medium">Källa</th>
              <th className="text-left p-2 text-xs font-medium">Belopp</th>
              <th className="text-left p-2 text-xs font-medium">Text</th>
              <th className="text-left p-2 text-xs font-medium">Betaldatum</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="p-2 text-sm">
                  {formatPaymentEventType(event.slTransactionType)}
                </td>
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
      <InvoicePaymentEventsTable
        events={events}
        isLoading={isLoading}
        error={error}
      />
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
    const canGrantDeferral =
      props.contactCode &&
      invoice.source === 'next' &&
      invoice.paymentStatus !== PaymentStatus.Paid &&
      !invoice.credit

    return (
      <>
        {invoice.description && (
          <div className="mb-3 text-sm bg-background/50 rounded p-2">
            <span className="font-medium">Text:</span> {invoice.description}
            {invoice.expectedLoss && <div>Befarad kundförlust</div>}
          </div>
        )}
        {invoice.credit && (
          <div className="mb-3 text-sm bg-background/50 rounded p-2">
            <span className="font-medium">Krediterar faktura:</span>{' '}
            {invoice.credit.originalInvoiceId}
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
        {canGrantDeferral && (
          <div className="mb-3">
            <GrantDeferralDialog
              invoice={invoice}
              contactCode={props.contactCode!}
            />
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
      expandedKeys={props.expandedInvoiceId ? [props.expandedInvoiceId] : []}
      onExpandedChange={(expandedKeys) =>
        props.onInvoiceRowClick(expandedKeys[0] ?? null)
      }
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
