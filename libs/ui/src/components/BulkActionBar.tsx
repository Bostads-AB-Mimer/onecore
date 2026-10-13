import type { ReactNode } from 'react'

import { cn } from '../lib/utils'
import { Button, type ButtonProps } from '../ui/Button'

export interface BulkAction {
  label: string
  onClick: () => void
  icon?: ReactNode
  variant?: ButtonProps['variant']
  disabled?: boolean
}

export interface BulkActionBarProps {
  selectedCount: number
  onClear: () => void
  actions: readonly BulkAction[]
  isLoading?: boolean // disables every action, e.g. while recipients load
  className?: string
}

/** Fixed bar at the bottom of the viewport; hidden while nothing is selected. */
export function BulkActionBar({
  selectedCount,
  onClear,
  actions,
  isLoading,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="toolbar"
      aria-label="Åtgärder för valda rader"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg animate-in slide-in-from-bottom-4',
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedCount.toLocaleString('sv-SE')} valda
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &times; Rensa
          </button>
        </div>
        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant ?? 'outline'}
              onClick={action.onClick}
              disabled={isLoading || action.disabled}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
