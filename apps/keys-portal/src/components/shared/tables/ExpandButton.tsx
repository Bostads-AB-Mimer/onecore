import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ExpandButtonProps {
  isExpanded: boolean
  isLoading?: boolean
  onClick: () => void
  className?: string
  size?: 'sm' | 'default'
}

/** Button for expanding/collapsing table rows, shows spinner when loading */
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
