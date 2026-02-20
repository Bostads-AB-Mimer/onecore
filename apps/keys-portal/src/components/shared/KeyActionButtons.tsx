import { ReactNode } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Plus, Copy, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

type ActionButton = {
  label: string
  count?: number
  onClick: () => void
  variant?: ButtonProps['variant']
  icon?: ReactNode
  enabled?: boolean
}

type Props = {
  selectedCount: number
  isProcessing: boolean
  loanAction?: ActionButton
  returnAction?: ActionButton
  flexAction?: ActionButton
  incomingFlexAction?: ActionButton
  disposeAction?: ActionButton
  customActions?: ActionButton[]
  bulkActions?: ActionButton[]
}

/**
 * Reusable action buttons component for key operations.
 * Supports both tenant key loans and maintenance key loans.
 * Configurable via props to enable different actions based on context.
 */
export function KeyActionButtons({
  selectedCount,
  isProcessing,
  loanAction,
  returnAction,
  flexAction,
  incomingFlexAction,
  disposeAction,
  customActions = [],
  bulkActions = [],
}: Props) {
  const hasSelectedKeys = selectedCount > 0

  return (
    <div className="flex flex-wrap gap-2">
      {/* Selected keys buttons */}
      {hasSelectedKeys && (
        <>
          {loanAction &&
            loanAction.enabled !== false &&
            loanAction.count > 0 && (
              <Button
                size="sm"
                variant={loanAction.variant || 'default'}
                onClick={loanAction.onClick}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                {loanAction.icon || <Plus className="h-3 w-3" />}
                {loanAction.label} ({loanAction.count})
              </Button>
            )}

          {returnAction &&
            returnAction.enabled !== false &&
            returnAction.count > 0 && (
              <Button
                size="sm"
                variant={returnAction.variant || 'secondary'}
                onClick={returnAction.onClick}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                {returnAction.icon}
                {returnAction.label} ({returnAction.count})
              </Button>
            )}

          {incomingFlexAction &&
            incomingFlexAction.enabled !== false &&
            incomingFlexAction.count > 0 && (
              <Button
                size="sm"
                variant={incomingFlexAction.variant || 'outline'}
                onClick={incomingFlexAction.onClick}
                disabled={isProcessing}
                className="flex items-center gap-1"
              >
                {incomingFlexAction.icon || <Copy className="h-3 w-3" />}
                {incomingFlexAction.label} ({incomingFlexAction.count})
              </Button>
            )}

          {flexAction && flexAction.enabled !== false && (
            <Button
              size="sm"
              variant={flexAction.variant || 'outline'}
              onClick={flexAction.onClick}
              disabled={isProcessing}
              className="flex items-center gap-1"
            >
              {flexAction.icon || <Copy className="h-3 w-3" />}
              {flexAction.label} ({selectedCount})
            </Button>
          )}

          {disposeAction && disposeAction.enabled !== false && (
            <Button
              size="sm"
              variant={disposeAction.variant || 'destructive'}
              onClick={disposeAction.onClick}
              disabled={isProcessing}
              className="flex items-center gap-1"
            >
              {disposeAction.icon || <Trash2 className="h-3 w-3" />}
              {disposeAction.label} ({selectedCount})
            </Button>
          )}

          {customActions.map(
            (action, index) =>
              action.enabled !== false && (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant || 'outline'}
                  onClick={action.onClick}
                  disabled={isProcessing}
                  className="flex items-center gap-1"
                >
                  {action.icon}
                  {action.label} ({action.count || selectedCount})
                </Button>
              )
          )}
        </>
      )}

      {/* Bulk action buttons (shown regardless of selection) */}
      {bulkActions.map(
        (action, index) =>
          action.enabled !== false &&
          action.count > 0 && (
            <Button
              key={index}
              size="sm"
              variant={action.variant || 'outline'}
              onClick={action.onClick}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Spinner size="sm" className="mr-1" />
              ) : (
                action.icon
              )}
              {action.label} ({action.count})
            </Button>
          )
      )}
    </div>
  )
}
