import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

import { formatCurrency } from '@/entities/lease'

import { routes } from '@/shared/routes'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/Alert'

import { MiscellaneousInvoiceReceiptData } from './MiscellaneousInvoiceReceipt'

interface UnknownSubmitOutcomeAlertProps {
  invoice: MiscellaneousInvoiceReceiptData
}

/**
 * Shown when a send failed in a way where the invoice basis may still have
 * been created. It names the invoice basis, since the form may have been
 * cleared or filled in for another customer since.
 */
export function UnknownSubmitOutcomeAlert({
  invoice,
}: UnknownSubmitOutcomeAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Vi vet inte om underlaget kom fram</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Gäller underlaget för {invoice.tenantName} ({invoice.contactCode}),
          hyreskontrakt {invoice.leaseId}, belopp{' '}
          {formatCurrency(invoice.total, 2)}.
        </p>
        <p>
          Kontrollera i{' '}
          <Link to={routes.miscellaneousInvoices} className="underline">
            listan över ströfakturor
          </Link>{' '}
          eller med{' '}
          <a href="mailto:ekonomi@mimer.nu" className="underline">
            ekonomi@mimer.nu
          </a>{' '}
          innan du skickar underlaget igen, annars kan kunden få dubbla
          fakturor.
        </p>
      </AlertDescription>
    </Alert>
  )
}
