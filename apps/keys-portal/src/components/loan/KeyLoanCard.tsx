import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertCircle,
  FileText,
  Upload,
  Printer,
  Download,
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type { KeyLoan, Key, Receipt } from '@/services/types'

interface KeyLoanCardProps {
  keyLoan: KeyLoan
  keys: Key[]
  receipts: Receipt[]
  loanReceipt?: Receipt
  returnReceipt?: Receipt
  isActive: boolean
  hasUnsignedLoanReceipt: boolean
  uploadingReceiptId: string | null
  uploadError: string | null
  onGenerateLoanReceipt: () => void
  onGenerateReturnReceipt?: () => void
  onUploadReceipt: (receiptId: string) => void
  onDownloadReceipt: (receipt: Receipt) => void
}

export function KeyLoanCard({
  keyLoan,
  keys,
  receipts,
  loanReceipt,
  returnReceipt,
  isActive,
  hasUnsignedLoanReceipt,
  uploadingReceiptId,
  uploadError,
  onGenerateLoanReceipt,
  onGenerateReturnReceipt,
  onUploadReceipt,
  onDownloadReceipt,
}: KeyLoanCardProps) {
  return (
    <Card
      className={`border rounded-lg ${
        hasUnsignedLoanReceipt && isActive
          ? 'border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
          : ''
      }`}
    >
      <CardContent className="p-2 space-y-1">
        {/* Compact header: keys + status + dates in one line */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          {/* Left: Keys and dates */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs font-medium truncate">
                {keys.length > 0 ? (
                  <span>{keys.map((k) => k.keyName).join(', ')}</span>
                ) : (
                  <span className="text-muted-foreground italic">Inga nycklar</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground flex gap-2">
                <span>
                  {keyLoan.createdAt
                    ? format(new Date(keyLoan.createdAt), 'dd/MM/yy', {
                        locale: sv,
                      })
                    : 'Okänd'}
                </span>
                {keyLoan.pickedUpAt && (
                  <span>
                    → {format(new Date(keyLoan.pickedUpAt), 'dd/MM/yy', {
                      locale: sv,
                    })}
                  </span>
                )}
                {keyLoan.returnedAt && (
                  <span>
                    → {format(new Date(keyLoan.returnedAt), 'dd/MM/yy', {
                      locale: sv,
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Status badges */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasUnsignedLoanReceipt && isActive && (
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1 border-yellow-600 text-yellow-600 bg-yellow-100 dark:bg-yellow-950 h-4"
              >
                <AlertCircle className="h-2 w-2 mr-0.5" />
                Ej signerad
              </Badge>
            )}
            {keyLoan.returnedAt ? (
              <Badge variant="secondary" className="text-[9px] py-0 px-1 h-4">
                Återlämnad
              </Badge>
            ) : (
              <Badge variant="default" className="text-[9px] py-0 px-1 h-4">
                Aktiv
              </Badge>
            )}
          </div>
        </div>

        {/* Warning for unsigned loan receipt - more compact */}
        {hasUnsignedLoanReceipt && isActive && loanReceipt && (
          <div className="bg-yellow-100 dark:bg-yellow-950/30 border border-yellow-600 rounded p-1.5 space-y-1">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="h-2.5 w-2.5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-[10px] text-yellow-800 dark:text-yellow-200">
                <p className="font-semibold">Utlåningskvitto ej signerat</p>
                <p className="mt-0.5">
                  Kvittot måste signeras och laddas upp.
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-[10px] h-6 border-yellow-600 hover:bg-yellow-100 px-1.5"
                onClick={() => onUploadReceipt(loanReceipt.id)}
                disabled={uploadingReceiptId === loanReceipt.id}
              >
                <Upload className="h-2 w-2 mr-0.5" />
                {uploadingReceiptId === loanReceipt.id
                  ? 'Laddar upp...'
                  : 'Ladda upp'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] h-6 px-1.5"
                onClick={onGenerateLoanReceipt}
              >
                <Printer className="h-2 w-2 mr-0.5" />
                Generera
              </Button>
            </div>
            {uploadError && (
              <div className="text-[10px] text-red-600 dark:text-red-400">
                {uploadError}
              </div>
            )}
          </div>
        )}

        {/* Compact receipts list */}
        {receipts.length > 0 && (
          <div className="pt-1 space-y-0.5 border-t">
            <div className="flex items-center justify-between gap-1">
              <div className="text-[10px] font-medium text-muted-foreground">
                Kvitton
              </div>
              <div className="flex gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[10px] h-5 px-1"
                  onClick={onGenerateLoanReceipt}
                >
                  <FileText className="h-2 w-2 mr-0.5" />
                  Utlåning
                </Button>
                {!isActive && onGenerateReturnReceipt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[10px] h-5 px-1"
                    onClick={onGenerateReturnReceipt}
                  >
                    <FileText className="h-2 w-2 mr-0.5" />
                    Retur
                  </Button>
                )}
              </div>
            </div>
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex items-center justify-between text-[10px] py-0.5"
              >
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">
                    {receipt.receiptType === 'LOAN' ? 'Utlåning' : 'Retur'}
                  </span>
                  {receipt.receiptType === 'LOAN' &&
                    (receipt.fileId ? (
                      <Badge
                        variant="default"
                        className="text-[8px] py-0 px-0.5 h-3"
                      >
                        ✓
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[8px] py-0 px-0.5 border-yellow-600 text-yellow-600 h-3"
                      >
                        !
                      </Badge>
                    ))}
                </div>
                <div className="flex items-center gap-0.5">
                  {receipt.fileId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1"
                      onClick={() => onDownloadReceipt(receipt)}
                    >
                      <Download className="h-2 w-2" />
                    </Button>
                  )}
                  {!receipt.fileId && receipt.receiptType === 'LOAN' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1 text-yellow-600"
                      onClick={() => onUploadReceipt(receipt.id)}
                      disabled={uploadingReceiptId === receipt.id}
                    >
                      <Upload className="h-2 w-2" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
