import React from 'react'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { cn } from '@/shared/lib/utils'
import { ScrollArea } from '@/shared/ui/ScrollArea'

interface FormWrapperProps {
  children: React.ReactNode
  className?: string
  onSubmit?: (e: React.FormEvent) => void
  maxHeight?: string
}

export function FormWrapper({
  children,
  className,
  onSubmit,
  maxHeight = '80vh',
}: FormWrapperProps) {
  const isMobile = useIsMobile()

  return (
    <div
      className={cn('max-h-screen overflow-hidden', isMobile ? 'p-2' : 'p-4')}
    >
      <ScrollArea
        className={cn('w-full', className)}
        style={{ height: maxHeight }}
      >
        <div className={cn(isMobile ? 'p-3 space-y-4' : 'p-6 space-y-6')}>
          {onSubmit ? (
            <form
              onSubmit={onSubmit}
              className={cn(isMobile ? 'space-y-4' : 'space-y-6')}
            >
              {children}
            </form>
          ) : (
            <div className={cn(isMobile ? 'space-y-4' : 'space-y-6')}>
              {children}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
