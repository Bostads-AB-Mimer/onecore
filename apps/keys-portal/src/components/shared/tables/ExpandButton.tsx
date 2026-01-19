import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ExpandButtonProps {
  /** Whether the row/section is currently expanded */
  isExpanded: boolean
  /** Whether data is currently loading */
  isLoading?: boolean
  /** Click handler to toggle expand/collapse */
  onClick: () => void
  /** Additional CSS classes */
  className?: string
  /** Size variant */
  size?: 'sm' | 'default'
}

/**
 * A button for expanding/collapsing table rows or sections.
 * Shows a loading spinner when data is being fetched.
 *
 * @example
 * ```tsx
 * <ExpandButton
 *   isExpanded={expansion.isExpanded(key.id)}
 *   isLoading={expansion.isLoading && expansion.expandedId === key.id}
 *   onClick={() => expansion.toggle(key.id)}
 * />
 * ```
 */
export function ExpandButton({
  isExpanded,
  isLoading = false,
  onClick,
  className,
  size = 'sm',
}: ExpandButtonProps) {
  return (
    <Button
      variant="ghost"
      size={size}
      onClick={onClick}
      className={cn('h-8 w-8 p-0', className)}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isExpanded ? (
        <ChevronDown className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )}
    </Button>
  )
}
