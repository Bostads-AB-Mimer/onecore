import * as React from 'react'

/**
 * cn (className utility) to merge Tailwind CSS classes
 * - Uses clsx to conditionally join classNames
 * - Uses twMerge to resolve Tailwind class conflicts
 *
 * Example: If base styles have "min-h-[80px]" and user passes "min-h-[120px]",
 * twMerge will correctly override to use only "min-h-[120px]" instead of both.
 *
 * Standard pattern in shadcn/ui components.
 */
import { cn } from '@/shared/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
