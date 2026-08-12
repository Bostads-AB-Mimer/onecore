import { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { KeyTypeLabels } from '@/services/types'
import { BeforeAfterDialogBase } from '@/components/loan/dialogs/BeforeAfterDialogBase'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ReturnLoanGroup } from '@/hooks/useReturnKeys'

type SecondaryAction = {
  label: string
  onClick: () => void
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loanGroups: ReturnLoanGroup[]
  loading: boolean
  selectedKeyIds: Set<string>
  selectedCardIds: Set<string>
  onToggleKey: (keyId: string, checked: boolean) => void
  onToggleCard: (cardId: string, checked: boolean) => void
  rightContent: ReactNode
  onAccept: () => void
  isProcessing: boolean
  acceptButtonText: string
  totalCount: number
  title?: string
  description?: string
  primaryLabel?: string
  secondaryAction?: SecondaryAction
}

const keyMeta = (key: ReturnLoanGroup['keys'][number]) =>
  [
    KeyTypeLabels[key.keyType],
    key.keySystem?.systemCode,
    key.flexNumber !== undefined ? `Flex: ${key.flexNumber}` : undefined,
    key.keySequenceNumber !== undefined
      ? `Löpnr: ${key.keySequenceNumber}`
      : undefined,
  ]
    .filter(Boolean)
    .join(' • ')

const OrphanIcon = ({ label }: { label: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

/**
 * Pure UI for returning keys + cards, grouped by loan. Renders checkboxes for
 * non-disposed items, a read-only disposed section, and orphan badges. Both the tenant
 * and maintenance return dialogs render through this; business logic lives in
 * `useReturnKeys`.
 */
export function ReturnKeysDialogBase({
  open,
  onOpenChange,
  loanGroups,
  loading,
  selectedKeyIds,
  selectedCardIds,
  onToggleKey,
  onToggleCard,
  rightContent,
  onAccept,
  isProcessing,
  acceptButtonText,
  totalCount,
  title = 'Återlämna nycklar',
  description = 'Välj vilka som ska visas på kvittensen',
  primaryLabel,
  secondaryAction,
}: Props) {
  const showGrouping = loanGroups.length > 1

  const leftContent = loading ? (
    <div className="text-sm text-muted-foreground">Laddar...</div>
  ) : (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {loanGroups.map((group) => {
        const nonDisposed = group.keys.filter((k) => !k.disposed)
        const disposed = group.keys.filter((k) => k.disposed)

        return (
          <div
            key={group.loanId}
            className={cn(
              showGrouping && 'p-3 border rounded-lg bg-muted/30 space-y-2'
            )}
          >
            {showGrouping && (
              <div className="text-xs font-semibold text-muted-foreground">
                {group.loanLabel}
              </div>
            )}

            {/* Non-disposed keys with checkboxes */}
            {nonDisposed.map((key) => (
              <div
                key={key.id}
                className="p-2 border rounded bg-card text-xs flex items-start gap-2"
              >
                <Checkbox
                  checked={selectedKeyIds.has(key.id)}
                  onCheckedChange={(c) => onToggleKey(key.id, c as boolean)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-1">
                    {key.keyName}
                    {key.isOrphan && (
                      <OrphanIcon label="Nyckeln är inte kopplad till hyresobjektet" />
                    )}
                  </div>
                  <div className="text-muted-foreground">{keyMeta(key)}</div>
                </div>
              </div>
            ))}

            {/* Disposed keys (no checkbox) */}
            {disposed.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Kasserade:
                </div>
                {disposed.map((key) => (
                  <div
                    key={key.id}
                    className="p-2 border rounded bg-destructive/5 border-destructive/20 text-xs"
                  >
                    <div className="font-medium text-destructive">
                      {key.keyName}
                    </div>
                    <div className="text-muted-foreground">{keyMeta(key)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Cards with checkboxes */}
            {group.cards.map((card) => (
              <div
                key={card.cardId}
                className="p-2 border rounded bg-card text-xs flex items-start gap-2"
              >
                <Checkbox
                  checked={selectedCardIds.has(card.cardId)}
                  onCheckedChange={(c) =>
                    onToggleCard(card.cardId, c as boolean)
                  }
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-1">
                    {card.name || card.cardId}
                    {card.isOrphan && (
                      <OrphanIcon label="Droppen är inte kopplad till hyresobjektet" />
                    )}
                  </div>
                </div>
              </div>
            ))}
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
      leftTitle="Nycklar och droppar som återlämnas"
      rightTitle="Detaljer"
      leftContent={leftContent}
      rightContent={rightContent}
      isProcessing={isProcessing}
      onAccept={onAccept}
      acceptButtonText={acceptButtonText}
      totalCount={totalCount}
      primaryLabel={primaryLabel}
      secondaryAction={secondaryAction}
    />
  )
}
