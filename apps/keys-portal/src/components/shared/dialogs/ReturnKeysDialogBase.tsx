import { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Key } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { BeforeAfterDialogBase } from '@/components/loan/dialogs/BeforeAfterDialogBase'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export type LoanGroup = {
  loanId: string
  loanLabel: string // "Lån 1 • F12345" or "Company AB"
  keys: Key[]
  disposedKeys: Key[]
  nonDisposedKeys: Key[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanGroups: LoanGroup[]
  loading: boolean
  selectedKeyIds: Set<string>
  onToggleKey: (keyId: string, checked: boolean) => void
  rightContent: ReactNode
  onAccept: () => void
  isProcessing: boolean
  acceptButtonText: string
  title?: string
  description?: string
}

/**
 * Pure UI component for returning keys dialog.
 * Works with both tenant key loans and maintenance key loans.
 * Business logic is handled by wrapper components.
 */
export function ReturnKeysDialogBase({
  open,
  onOpenChange,
  loanGroups,
  loading,
  selectedKeyIds,
  onToggleKey,
  rightContent,
  onAccept,
  isProcessing,
  acceptButtonText,
  title = 'Återlämna nycklar',
  description = 'Välj vilka nycklar som ska visas på kvittensen',
}: Props) {
  const totalKeys = loanGroups.reduce(
    (sum, loanInfo) => sum + loanInfo.keys.length,
    0
  )

  // Left side content - keys being returned grouped by loan
  const leftContent = loading ? (
    <div className="text-sm text-muted-foreground">Laddar...</div>
  ) : (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {loanGroups.map((loanInfo) => {
        const showLoanGrouping = loanGroups.length > 1 && loanInfo.loanLabel

        return (
          <div
            key={loanInfo.loanId}
            className={cn(
              showLoanGrouping && 'p-3 border rounded-lg bg-muted/30 space-y-2'
            )}
          >
            {showLoanGrouping && (
              <div className="text-xs font-semibold text-muted-foreground">
                {loanInfo.loanLabel}
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
                        onToggleKey(key.id, checked as boolean)
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
                          ` • Löpnr: ${key.keySequenceNumber}`}
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
                        ` • Löpnr: ${key.keySequenceNumber}`}
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

  return (
    <BeforeAfterDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      leftTitle="Nycklar som återlämnas"
      rightTitle="Detaljer"
      leftContent={leftContent}
      rightContent={rightContent}
      isProcessing={isProcessing}
      onAccept={onAccept}
      acceptButtonText={acceptButtonText}
      totalCount={totalKeys}
    />
  )
}
