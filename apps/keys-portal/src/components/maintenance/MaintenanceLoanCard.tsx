import { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, User, FileText, AlertCircle, Undo2 } from 'lucide-react'
import type { KeyLoanMaintenanceKeysWithDetails } from '@/services/types'
import { MaintenanceKeysTable } from './MaintenanceKeysTable'
import { MaintenanceReceiptActions } from './MaintenanceReceiptActions'
import { ReturnMaintenanceKeysDialog } from './dialogs/ReturnMaintenanceKeysDialog'

type Props = {
  loan: KeyLoanMaintenanceKeysWithDetails
  keySystemMap: Record<string, string>
  onRefresh?: () => void
}

export function MaintenanceLoanCard({ loan, keySystemMap, onRefresh }: Props) {
  const isReturned = !!loan.returnedAt
  const isActive = !isReturned
  const hasNoReceipt = isActive && !loan.pickedUpAt
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)

  // Get all key IDs for this loan
  const allKeyIds = loan.keysArray.map((k) => k.id)

  return (
    <>
      <ReturnMaintenanceKeysDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        keyIds={allKeyIds}
        allKeys={loan.keysArray}
        onSuccess={() => {
          setReturnDialogOpen(false)
          onRefresh?.()
        }}
      />
      <Card
        className={`overflow-hidden ${
          hasNoReceipt
            ? 'border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
            : ''
        }`}
      >
        {/* Loan Header - Acts as "table header" */}
        <div
          className={`px-4 py-3 border-b ${
            isReturned
              ? 'bg-muted/50'
              : hasNoReceipt
                ? 'bg-yellow-100 dark:bg-yellow-950/30'
                : 'bg-primary/5'
          }`}
        >
          {/* Top row: Contact/Description on left, Badges/Dates on right */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1 space-y-1.5">
              {/* Contact Person */}
              {loan.contactPerson && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{loan.contactPerson}</span>
                </div>
              )}

              {/* Description */}
              {loan.description && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{loan.description}</span>
                </div>
              )}
            </div>

            {/* Status Badge and Dates column */}
            <div className="flex flex-col gap-2 items-end">
              <div className="flex items-center gap-1">
                {hasNoReceipt && (
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 px-1 border-yellow-600 text-yellow-600 bg-yellow-100 dark:bg-yellow-950 h-4"
                  >
                    <AlertCircle className="h-2 w-2 mr-0.5" />
                    Saknar kvittens
                  </Badge>
                )}
                <Badge variant={isReturned ? 'secondary' : 'default'}>
                  {isReturned ? 'Återlämnad' : 'Aktiv'}
                </Badge>
              </div>

              {/* Dates: Handle different scenarios */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {!loan.pickedUpAt && !loan.returnedAt ? (
                  // Case 1: Not picked up and not returned
                  <span>
                    Lån skapat{' '}
                    {loan.createdAt
                      ? format(new Date(loan.createdAt), 'dd/MM/yy', {
                          locale: sv,
                        })
                      : 'okänt datum'}
                    , ej upphämtat
                  </span>
                ) : !loan.pickedUpAt && loan.returnedAt ? (
                  // Case 2: Returned but never picked up (returned without signed receipt)
                  <span>
                    Återlämnad{' '}
                    {format(new Date(loan.returnedAt), 'dd/MM/yy', {
                      locale: sv,
                    })}
                    , ej upphämtat
                  </span>
                ) : (
                  // Case 3: Picked up (with or without return)
                  <span>
                    {format(new Date(loan.pickedUpAt!), 'dd/MM/yy', {
                      locale: sv,
                    })}
                    {loan.returnedAt && (
                      <>
                        {' '}
                        →{' '}
                        {format(new Date(loan.returnedAt), 'dd/MM/yy', {
                          locale: sv,
                        })}
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom row: Warning LEFT, Return button and Receipt buttons RIGHT - spans full width */}
          <div className="flex items-center justify-between">
            {/* Warning for missing receipt - LEFT SIDE */}
            {hasNoReceipt ? (
              <div className="flex items-center gap-1.5 bg-yellow-100 dark:bg-yellow-950/30 border border-yellow-600 rounded px-2 py-1">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
                <span className="text-xs text-yellow-800 dark:text-yellow-200">
                  <span className="font-semibold">Kvittens saknas.</span> Lånet
                  har skapats men inget kvittens har laddats upp ännu.
                </span>
              </div>
            ) : (
              <div />
            )}

            {/* Return button and Receipt buttons - RIGHT SIDE */}
            <div className="flex items-center gap-2">
              {/* Return button - only show for active loans */}
              {isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReturnDialogOpen(true)}
                >
                  <Undo2 className="h-4 w-4 mr-1" />
                  Återlämna
                </Button>
              )}

              {/* Receipt buttons */}
              <MaintenanceReceiptActions
                loanId={loan.id}
                onRefresh={onRefresh}
              />
            </div>
          </div>
        </div>

        {/* Keys Table - Acts as "table body" */}
        <CardContent className="p-0">
          <MaintenanceKeysTable
            keys={loan.keysArray}
            keySystemMap={keySystemMap}
          />
        </CardContent>
      </Card>
    </>
  )
}
