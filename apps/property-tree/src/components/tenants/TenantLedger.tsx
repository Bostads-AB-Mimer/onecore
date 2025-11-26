import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
//import type { CustomerLedger } from '@/types/ledger'
//import type { Invoice } from '@/types/invoice'
import { Badge } from '@/components/ui/v2/Badge'
import { InvoicesTable } from './InvoicesTable'
import { components } from '@/services/api/core/generated/api-types'
import { Contact, Invoice, Lease } from '@onecore/types'
import { useTenant } from '../hooks/useTenant'
import { useTenantInvoices } from '../hooks/useTenantInvoices'

interface TenantLedgerProps {
  contactCode: string
}

export const TenantLedger = ({ contactCode }: TenantLedgerProps) => {
  const invoices = useTenantInvoices(contactCode)

  // Mocked ledgerdata
  const ledger = {
    autogiro: { active: true },
    invoiceSettings: {
      eInvoice: false,
      emailInvoice: true,
    },
    balances: {
      overdue: 1500.0,
      collections: 0.0,
      submittedToCollections: 1,
      recalledFromCollections: 0,
      preliminaryRefund: 0.0,
      deposit: 5000.0,
      credit: 200.0,
      incorrectPayment: 0.0,
    },
    statistics: {
      demandsLastYear: 2,
      averageDaysLate: 5,
    },
  }

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2).replace('.', ',') + ' SEK'
  }

  const getInvoiceMethod = () => {
    if (ledger.autogiro.active) return 'Autogiro'
    if (ledger.invoiceSettings.eInvoice) return 'E-faktura'
    if (ledger.invoiceSettings.emailInvoice) return 'E-postfaktura'
    return 'Pappersfaktura'
  }

  const InfoRow = ({
    label,
    value,
    highlight = false,
  }: {
    label: string
    value: string | number
    highlight?: boolean
  }) => (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span
        className={`text-sm font-medium ${highlight ? 'text-destructive' : ''}`}
      >
        {value}
      </span>
    </div>
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Betalningsinformation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Faktureringsinställningar */}
          <div className="space-y-1">
            <InfoRow
              label="Alternativ för avisering"
              value={getInvoiceMethod()}
            />
          </div>

          {/* Balans och saldon */}
          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div className="space-y-1">
              <InfoRow
                label="Förfallet"
                value={formatCurrency(ledger.balances.overdue)}
                highlight={ledger.balances.overdue > 0}
              />
              <InfoRow
                label="Inkasso"
                value={formatCurrency(ledger.balances.collections)}
                highlight={ledger.balances.collections > 0}
              />
              <InfoRow
                label="Överlämnade inkassoärenden"
                value={ledger.balances.submittedToCollections}
                highlight={ledger.balances.submittedToCollections > 0}
              />
              <InfoRow
                label="Återkallade inkassoärenden"
                value={ledger.balances.recalledFromCollections}
              />
              <InfoRow
                label="Prel. bokad återbetalning"
                value={formatCurrency(ledger.balances.preliminaryRefund)}
              />
            </div>
            <div className="space-y-1">
              <InfoRow
                label="Antal krav senaste året"
                value={ledger.statistics.demandsLastYear}
                highlight={ledger.statistics.demandsLastYear > 0}
              />
              <InfoRow
                label="Medelvärde antal dagar för sent betalt"
                value={`${ledger.statistics.averageDaysLate} dagar`}
                highlight={ledger.statistics.averageDaysLate > 0}
              />
              <InfoRow
                label="Deposition"
                value={formatCurrency(ledger.balances.deposit)}
              />
              <InfoRow
                label="Tillgodo"
                value={formatCurrency(ledger.balances.credit)}
              />
              <InfoRow
                label="Felaktig inbetalning"
                value={formatCurrency(ledger.balances.incorrectPayment)}
                highlight={ledger.balances.incorrectPayment > 0}
              />
            </div>
          </div>

          {/* Varningsmeddelande om det finns problem */}
          {(ledger.balances.overdue > 0 ||
            ledger.balances.collections > 0 ||
            ledger.balances.submittedToCollections > 0) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>OBS:</strong> Kunden har utestående betalningar eller
                inkassoärenden.
              </p>
            </div>
          )}

          {/* Positiv balans */}
          {ledger.balances.credit > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                Kunden har ett tillgodohavande på{' '}
                {formatCurrency(ledger.balances.credit)}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fakturor</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.data && <InvoicesTable invoices={invoices.data} />}
        </CardContent>
      </Card>
    </div>
  )
}
