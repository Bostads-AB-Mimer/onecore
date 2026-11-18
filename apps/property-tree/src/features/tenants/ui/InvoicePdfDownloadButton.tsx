import { Invoice } from '@onecore/types'
import { Download } from 'lucide-react'

import { Button } from '@/shared/ui/Button'

import { useInvoicePdfDownload } from '../hooks/useInvoicePdfDownload'

type Props = {
  invoice: Invoice
}

export const InvoicePdfDownloadButton = ({ invoice }: Props) => {
  const download = useInvoicePdfDownload()

  if (!invoice.hasRentNoticePdf) {
    return null
  }

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        disabled={download.isPending}
        onClick={(e) => {
          e.stopPropagation()
          download.mutate(invoice.invoiceId)
        }}
        className="w-full sm:w-auto"
      >
        <Download className="h-4 w-4 mr-2" />
        {download.isPending ? 'Laddar ner…' : 'Ladda ner hyresavi'}
      </Button>
      {download.data === false && (
        <p className="text-sm text-destructive">Ingen hyresavi hittades.</p>
      )}
      {download.isError && (
        <p className="text-sm text-destructive">
          Kunde inte ladda ner hyresavin.
        </p>
      )}
    </div>
  )
}
