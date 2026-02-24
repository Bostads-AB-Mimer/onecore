import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BulkAction {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'outline' | 'destructive'
  disabled?: boolean
}

interface BulkActionBarProps {
  selectedCount: number
  onClear: () => void
  actions: BulkAction[]
  isLoading?: boolean
  className?: string
}

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
            onClick={onClear}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &times; Rensa
          </button>
        </div>
        <div className="flex items-center gap-2">
          {actions.map((action, idx) => (
            <Button
              key={idx}
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
