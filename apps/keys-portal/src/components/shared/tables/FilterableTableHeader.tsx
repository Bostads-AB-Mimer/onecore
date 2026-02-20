import React from 'react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface FilterableTableHeaderProps {
  label: string
  children?: React.ReactNode
  className?: string
  width?: string
}

/** Table header cell with optional filter component */
export function FilterableTableHeader({
  label,
  children,
  className,
  width,
}: FilterableTableHeaderProps) {
  return (
    <TableHead className={cn('font-medium', width, className)}>
      <div className="flex items-center gap-1">
        {label}
        {children}
      </div>
    </TableHead>
  )
}
