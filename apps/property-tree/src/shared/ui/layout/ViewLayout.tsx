import { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface ViewLayoutProps {
  children: ReactNode
  className?: string
}

/**
 * Consistent outer container for all views.
 * Provides max-width, horizontal padding, vertical padding, and entry animation.
 */
export function ViewLayout({ children, className }: ViewLayoutProps) {
  return (
    <div
      className={cn(
        'w-full max-w-screen-3xl mx-auto px-2 py-4 animate-in',
        className
      )}
    >
      {children}
    </div>
  )
}
