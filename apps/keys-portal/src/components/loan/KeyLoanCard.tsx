import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertCircle,
  FileText,
  Upload,
  Printer,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

import type { KeyLoan, Key, Receipt, Lease } from '@/services/types'

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
  onToggleReturnAccordion: () => void
  onUploadReceipt: (receiptId: string) => void
  onDownloadReceipt: (receipt: Receipt) => void
  isReturnAccordionOpen: boolean
  renderReturnAccordion?: () => React.ReactNode
}

export function KeyLoanCard({
  keyLoan,
  keys,
  receipts,
  loanReceipt,
  isActive,
  hasUnsignedLoanReceipt,
  uploadingReceiptId,
  uploadError,
  onGenerateLoanReceipt,
  onToggleReturnAccordion,
  onUploadReceipt,
  onDownloadReceipt,
  isReturnAccordionOpen,
  renderReturnAccordion,
}: KeyLoanCardProps) {
  return (
    <Card
      className={`border rounded-lg ${
        hasUnsignedLoanReceipt && isActive
          ? 'border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
          : ''
      }`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Keys in this loan */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {keys.length > 0 ? (
              <span>{keys.map((k) => k.keyName).join(', ')}</span>
            ) : (
              <span className="text-muted-foreground italic">Inga nycklar</span>
            )}
          </div>
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {hasUnsignedLoanReceipt && isActive && (
              <Badge
                variant="outline"
                className="text-xs border-yellow-600 text-yellow-600 bg-yellow-100 dark:bg-yellow-950"
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                Ej signerad
              </Badge>
            )}
            {keyLoan.returnedAt ? (
              <Badge variant="secondary" className="text-xs">
                Återlämnad
              </Badge>
            ) : (
              <Badge variant="default" className="text-xs">
                Aktiv
              </Badge>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            Skapad:{' '}
            {keyLoan.createdAt
              ? format(new Date(keyLoan.createdAt), 'dd MMM yyyy', {
                  locale: sv,
                })
              : 'Okänd'}
          </div>
          {keyLoan.pickedUpAt && (
            <div>
              Hämtad:{' '}
              {format(new Date(keyLoan.pickedUpAt), 'dd MMM yyyy', {
                locale: sv,
              })}
            </div>
          )}
          {keyLoan.returnedAt && (
            <div>
              Återlämnad:{' '}
              {format(new Date(keyLoan.returnedAt), 'dd MMM yyyy', {
                locale: sv,
              })}
            </div>
          )}
        </div>

        {/* Warning for unsigned loan receipt */}
        {hasUnsignedLoanReceipt && isActive && loanReceipt && (
          <div className="bg-yellow-100 dark:bg-yellow-950/30 border border-yellow-600 rounded p-2 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <p className="font-semibold">Utlåningskvitto ej signerat</p>
                <p className="mt-1">
                  Nycklarna är inte officiellt utlånade förrän kvittot är
                  signerat och uppladdat.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs border-yellow-600 hover:bg-yellow-100"
                onClick={() => onUploadReceipt(loanReceipt.id)}
                disabled={uploadingReceiptId === loanReceipt.id}
              >
                <Upload className="h-3 w-3 mr-1" />
                {uploadingReceiptId === loanReceipt.id
                  ? 'Laddar upp...'
                  : 'Ladda upp signerad PDF'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={onGenerateLoanReceipt}
              >
                <Printer className="h-3 w-3 mr-1" />
                Generera igen
              </Button>
            </div>
            {uploadError && (
              <div className="text-xs text-red-600 dark:text-red-400">
                ⚠️ {uploadError}
              </div>
            )}
          </div>
        )}

        {/* Receipt Buttons */}
        <div className="flex gap-2 pt-2">
          {/* Loan Receipt Button */}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={onGenerateLoanReceipt}
          >
            <FileText className="h-3 w-3 mr-1" />
            Utlåningskvitto
          </Button>

          {/* Partial Return / Replacement Button - only show if keys have NOT been returned yet */}
          {!keyLoan.returnedAt && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={onToggleReturnAccordion}
            >
              {isReturnAccordionOpen ? (
                <ChevronUp className="h-3 w-3 mr-1" />
              ) : (
                <ChevronDown className="h-3 w-3 mr-1" />
              )}
              Byte/Delretur
            </Button>
          )}
        </div>

        {/* Partial Return / Replacement Accordion - rendered by parent */}
        {renderReturnAccordion && renderReturnAccordion()}

        {/* Show existing receipts */}
        {receipts.length > 0 && (
          <div className="pt-2 space-y-1 border-t">
            <div className="text-xs font-medium text-muted-foreground">
              Kvitton:
            </div>
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {receipt.receiptType === 'LOAN' ? 'Utlåning' : 'Retur'}
                  </span>
                  {receipt.receiptType === 'LOAN' &&
                    (receipt.fileId ? (
                      <Badge
                        variant="default"
                        className="text-[10px] py-0 px-1"
                      >
                        ✓ Signerad
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1 border-yellow-600 text-yellow-600"
                      >
                        Ej signerad
                      </Badge>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                  {receipt.fileId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onClick={() => onDownloadReceipt(receipt)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  {!receipt.fileId && receipt.receiptType === 'LOAN' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-yellow-600"
                      onClick={() => onUploadReceipt(receipt.id)}
                      disabled={uploadingReceiptId === receipt.id}
                    >
                      <Upload className="h-3 w-3" />
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
