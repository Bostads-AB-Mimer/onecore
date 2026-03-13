import { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface FilterChipProps {
  selected: boolean
  onSelect: () => void
  children: ReactNode
  className?: string
}

export const FilterChip = ({
  selected,
  onSelect,
  children,
  className,
}: FilterChipProps) => {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
        'border border-input hover:bg-accent hover:text-accent-foreground',
        selected && 'bg-primary text-primary-foreground hover:bg-primary/90',
        className
      )}
    >
      {children}
    </button>
  )
}
