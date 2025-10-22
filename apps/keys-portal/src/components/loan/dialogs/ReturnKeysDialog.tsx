import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, AlertCircle } from 'lucide-react'
import type { Key, Lease } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { BeforeAfterDialogBase } from './BeforeAfterDialogBase'
import { handleReturnKeys } from '@/services/loanHandlers'
import { useToast } from '@/hooks/use-toast'
import { keyLoanService } from '@/services/api/keyLoanService'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

type KeysByLoan = {
  loanId: string
  contact: string | null
  keys: Key[]
  disposedKeys: Key[]
  nonDisposedKeys: Key[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  keyIds: string[] // Key IDs selected for return
  allKeys: Key[] // All keys to look up key details
  lease: Lease
  onSuccess: () => void
}

export function ReturnKeysDialog({
  open,
  onOpenChange,
  keyIds,
  allKeys,
  lease,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [keysByLoan, setKeysByLoan] = useState<KeysByLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set())
  const [availableDate, setAvailableDate] = useState<Date | undefined>(
    undefined
  )

  // Initialize available date to lease end date
  useEffect(() => {
    if (lease.leaseEndDate) {
      setAvailableDate(new Date(lease.leaseEndDate))
    } else {
      setAvailableDate(undefined)
    }
  }, [lease.leaseEndDate])

  // Fetch loan information for all keys being returned
  useEffect(() => {
    if (!open) return

    const fetchLoans = async () => {
      setLoading(true)
      try {
        // Get all keys being returned
        const keysToReturn = allKeys.filter((k) => keyIds.includes(k.id))

        // Build a map of unique active loans
        const loansMap = new Map<string, KeysByLoan>()

        for (const key of keysToReturn) {
          const loans = await keyLoanService.getByKeyId(key.id)
          const activeLoan = loans.find((loan) => !loan.returnedAt)

          if (activeLoan) {
            if (!loansMap.has(activeLoan.id)) {
              // Parse all keys in this loan
              const loanKeyIds: string[] = JSON.parse(activeLoan.keys || '[]')
              const loanKeys = allKeys.filter((k) => loanKeyIds.includes(k.id))

              loansMap.set(activeLoan.id, {
                loanId: activeLoan.id,
                contact: activeLoan.contact || null,
                keys: loanKeys,
                disposedKeys: loanKeys.filter((k) => k.disposed),
                nonDisposedKeys: loanKeys.filter((k) => !k.disposed),
              })
            }
          }
        }

        setKeysByLoan(Array.from(loansMap.values()))

        // Initialize selected keys - check all keys that were originally selected
        const initialSelectedKeys = new Set<string>()
        loansMap.forEach((loanInfo) => {
          loanInfo.nonDisposedKeys.forEach((key) => {
            if (keyIds.includes(key.id)) {
              initialSelectedKeys.add(key.id)
            }
          })
        })
        setSelectedKeyIds(initialSelectedKeys)
      } finally {
        setLoading(false)
      }
    }

    fetchLoans()
  }, [open, keyIds, allKeys])

  const handleAccept = async () => {
    setIsProcessing(true)

    try {
      // Get all key IDs from all loans (must return entire loan)
      const allKeyIdsToReturn = keysByLoan.flatMap((loanInfo) =>
        loanInfo.keys.map((k) => k.id)
      )

      const result = await handleReturnKeys({
        keyIds: allKeyIdsToReturn,
        availableToNextTenantFrom: availableDate?.toISOString(),
        selectedForReceipt: Array.from(selectedKeyIds),
        lease,
      })

      if (result.success) {
        toast({
          title: result.title,
          description: result.message,
        })
        onOpenChange(false)
        onSuccess()
      } else {
        toast({
          title: result.title,
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Fel',
        description: err?.message || 'Kunde inte återlämna nycklar',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const totalKeys = keysByLoan.reduce(
    (sum, loanInfo) => sum + loanInfo.keys.length,
    0
  )

  // Left side content - keys being returned grouped by loan
  const leftContent = loading ? (
    <div className="text-sm text-muted-foreground">Laddar...</div>
  ) : (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {keysByLoan.map((loanInfo, index) => {
        const showLoanGrouping = keysByLoan.length > 1

        return (
          <div
            key={loanInfo.loanId}
            className={cn(
              showLoanGrouping && 'p-3 border rounded-lg bg-muted/30 space-y-2'
            )}
          >
            {showLoanGrouping && (
              <div className="text-xs font-semibold text-muted-foreground">
                Lån {index + 1}
                {loanInfo.contact && ` • ${loanInfo.contact}`}
              </div>
            )}

            {/* Non-disposed keys with checkboxes */}
            {loanInfo.nonDisposedKeys.length > 0 && (
              <div className="space-y-1">
                {loanInfo.nonDisposedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="p-2 border rounded bg-card text-xs flex items-start gap-2"
                  >
                    <Checkbox
                      checked={selectedKeyIds.has(key.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedKeyIds)
                        if (checked) {
                          newSelected.add(key.id)
                        } else {
                          newSelected.delete(key.id)
                        }
                        setSelectedKeyIds(newSelected)
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{key.keyName}</div>
                      <div className="text-muted-foreground">
                        {KeyTypeLabels[key.keyType]}
                        {key.flexNumber !== undefined &&
                          ` • Flex: ${key.flexNumber}`}
                        {key.keySequenceNumber !== undefined &&
                          ` • Sekv: ${key.keySequenceNumber}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Disposed keys (no checkboxes) */}
            {loanInfo.disposedKeys.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Kasserade:
                </div>
                {loanInfo.disposedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="p-2 border rounded bg-destructive/5 border-destructive/20 text-xs"
                  >
                    <div className="font-medium text-destructive">
                      {key.keyName}
                    </div>
                    <div className="text-muted-foreground">
                      {KeyTypeLabels[key.keyType]}
                      {key.flexNumber !== undefined &&
                        ` • Flex: ${key.flexNumber}`}
                      {key.keySequenceNumber !== undefined &&
                        ` • Sekv: ${key.keySequenceNumber}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // Right side content - date picker
  const rightContent = (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Välj datum när nycklarna blir tillgängliga för nästa hyresgäst:
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !availableDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {availableDate ? (
              format(availableDate, 'PPP')
            ) : (
              <span>Välj datum</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={availableDate}
            onSelect={setAvailableDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {!availableDate && (
        <div className="text-xs text-muted-foreground">
          Inget datum valt - nycklarna blir tillgängliga direkt
        </div>
      )}
    </div>
  )

  return (
    <BeforeAfterDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title="Återlämna nycklar"
      description="Välj vilka nycklar som ska visas på kvittensen och när nycklarna blir tillgängliga för nästa hyresgäst."
      leftTitle="Nycklar som återlämnas"
      rightTitle="Tillgängligt från"
      leftContent={leftContent}
      rightContent={rightContent}
      isProcessing={isProcessing}
      onAccept={handleAccept}
      acceptButtonText="Återlämna"
      totalCount={totalKeys}
    />
  )
}
