import { Invoice } from '@onecore/types'

import { INVOICE_DEFERRAL_ROLE, RequireRole } from '@/entities/user'

import { canGrantInvoiceDeferral } from '../lib/invoiceDeferral'
import { GrantDeferralDialog } from './GrantDeferralDialog'

type Props = {
  invoice: Invoice
  contactCode: string
}

export const InvoiceDeferralAction = ({ invoice, contactCode }: Props) => {
  if (!canGrantInvoiceDeferral(invoice)) {
    return null
  }

  return (
    <RequireRole roles={[INVOICE_DEFERRAL_ROLE]}>
      <div className="mb-3">
        <GrantDeferralDialog invoice={invoice} contactCode={contactCode} />
      </div>
    </RequireRole>
  )
}
