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
        'w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 animate-in',
        className
      )}
    >
      {children}
    </div>
  )
}
