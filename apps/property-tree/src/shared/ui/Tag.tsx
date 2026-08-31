import * as React from 'react'

import { cn } from '@/shared/lib/utils'

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Tailwind background class, e.g. "bg-amber-400" */
  bg?: string
  /** Tailwind text color class, e.g. "text-black" */
  color?: string
}

/**
 * Generic tag component for categorization/labeling (building types, tags, etc.).
 * Unlike Badge (status indicators), Tag is for descriptive labels with custom colors.
 */
export function Tag({
  bg = 'bg-muted',
  color = 'text-muted-foreground',
  className,
  children,
  ...props
}: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        bg,
        color,
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
