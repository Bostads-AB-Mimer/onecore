import { useState } from 'react'
import { Invoice } from '@onecore/types'
import { Mail } from 'lucide-react'

import { useToast } from '@/shared/hooks/useToast'
import { Button } from '@/shared/ui/Button'
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
  type SendInvoiceError,
  useSendInvoiceToCustomer,
} from '../hooks/useSendInvoiceToCustomer'

const sendErrorMessages: Partial<Record<SendInvoiceError['reason'], string>> = {
  'no-email': 'Kunden saknar e-postadress.',
  'no-recipient': 'Hittade ingen mottagare för fakturan.',
  'pdf-not-found': 'Ingen faktura-PDF hittades.',
  'invoice-not-found': 'Fakturan hittades inte.',
  'missing-due-date': 'Fakturan saknar förfallodatum.',
}

// Rent notices can be emailed when their PDF exists; miscellaneous invoices
// when the ledger has a file for them.
const canSendInvoice = (invoice: Invoice) =>
  !!invoice.hasRentNoticePdf ||
  (invoice.type === 'Other' && !!invoice.invoiceFileUrl)

type Props = {
  invoice: Invoice
}

export const InvoiceSendButton = ({ invoice }: Props) => {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const sendInvoice = useSendInvoiceToCustomer()

  if (!canSendInvoice(invoice)) {
    return null
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) sendInvoice.reset()
  }

  const handleSend = () => {
    sendInvoice.mutate(invoice, {
      onSuccess: () => {
        handleOpenChange(false)
        toast({
          title: 'Fakturan skickad',
          description: `Faktura ${invoice.invoiceId} har mejlats till kunden.`,
        })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:w-auto"
        >
          <Mail className="h-4 w-4 mr-2" />
          Mejla faktura
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Mejla faktura</DialogTitle>
          <DialogDescription>
            Skicka faktura {invoice.invoiceId} med PDF till kundens registrerade
            e-postadress?
          </DialogDescription>
        </DialogHeader>
        {sendInvoice.error && (
          <p className="text-sm text-destructive">
            {sendErrorMessages[sendInvoice.error.reason] ??
              'Fakturan kunde inte skickas.'}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={sendInvoice.isPending}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={sendInvoice.isPending}
          >
            {sendInvoice.isPending ? 'Skickar…' : 'Skicka'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
