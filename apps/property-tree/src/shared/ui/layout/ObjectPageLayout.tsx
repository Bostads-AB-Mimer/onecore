import { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface ObjectPageLayoutProps<T> {
  isLoading: boolean
  error: Error | null
  data: T | null | undefined
  notFoundMessage: string
  searchedFor?: string
  children: ReactNode | ((data: T) => ReactNode)
  /** Custom classes for the success-state wrapper (default: 3-col grid) */
  className?: string
}

export function ObjectPageLayout<T>({
  isLoading,
  error,
  data,
  notFoundMessage,
  searchedFor,
  children,
  className,
}: ObjectPageLayoutProps<T>) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 py-4">
        <div className="h-8 bg-secondary rounded w-64"></div>
        <div className="h-4 bg-secondary rounded w-32 mt-2"></div>
        <div className="h-[200px] bg-secondary rounded mt-6"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-10 space-y-4">
        <h2 className="text-2xl font-bold">{notFoundMessage}</h2>
        <p className="text-muted-foreground">
          Kontrollera adressen och försök igen
        </p>
        {searchedFor && (
          <p className="text-sm text-muted-foreground mt-2">
            Sökte efter: {searchedFor}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {typeof children === 'function' ? children(data) : children}
    </div>
  )
}
