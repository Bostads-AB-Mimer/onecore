import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
} as const

type SpinnerProps = {
  size?: keyof typeof sizes
  className?: string
  centered?: boolean
}

export function Spinner({ size = 'md', className, centered }: SpinnerProps) {
  const spinner = (
    <Loader2
      className={cn(
        sizes[size],
        'animate-spin text-muted-foreground',
        className
      )}
    />
  )
  if (centered) {
    return (
      <div className="flex items-center justify-center py-8">{spinner}</div>
    )
  }
  return spinner
}
