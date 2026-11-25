import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

import { formatCurrency, formatDate } from '@/entities/lease'

import { routes } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'

export interface MiscellaneousInvoiceReceiptData {
  tenantName: string
  contactCode: string
  leaseId: string
  rentalObject?: string
  invoiceDate: Date
  rowCount: number
  total: number
}

interface MiscellaneousInvoiceReceiptProps {
  receipt: MiscellaneousInvoiceReceiptData
  onCreateNew: () => void
}

export function MiscellaneousInvoiceReceipt({
  receipt,
  onCreateNew,
}: MiscellaneousInvoiceReceiptProps) {
  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
        <div>
          <h2 className="text-lg font-semibold">
            Underlaget är skickat till ekonomi
          </h2>
          <p className="text-sm text-muted-foreground">
            Skicka inte samma underlag igen. Kontrollera listan över
            ströfakturor om du är osäker.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Kund</dt>
        <dd>
          {receipt.tenantName} ({receipt.contactCode})
        </dd>
        <dt className="text-muted-foreground">Hyreskontrakt</dt>
        <dd>
          {receipt.leaseId}
          {receipt.rentalObject && ` – ${receipt.rentalObject}`}
        </dd>
        <dt className="text-muted-foreground">Fakturadatum</dt>
        <dd>{formatDate(receipt.invoiceDate)}</dd>
        <dt className="text-muted-foreground">Antal rader</dt>
        <dd>{receipt.rowCount}</dd>
        <dt className="text-muted-foreground">Belopp</dt>
        {/* Shown with öre so staff can check it against what they entered */}
        <dd className="font-medium">{formatCurrency(receipt.total, 2)}</dd>
      </dl>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <Button variant="outline" asChild>
          <Link to={routes.miscellaneousInvoices}>Visa ströfakturor</Link>
        </Button>
        <Button type="button" onClick={onCreateNew}>
          Skapa nytt underlag
        </Button>
      </div>
    </Card>
  )
}
