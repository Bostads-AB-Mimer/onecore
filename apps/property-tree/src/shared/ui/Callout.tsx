import { AlertTriangle, Info, Lightbulb, type LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

export type CalloutType = 'tip' | 'note' | 'warning'

const CALLOUT_STYLES: Record<
  CalloutType,
  { label: string; icon: LucideIcon; className: string }
> = {
  tip: {
    label: 'Tips',
    icon: Lightbulb,
    className: 'border-green-200 bg-green-50 text-green-900',
  },
  note: {
    label: 'Obs',
    icon: Info,
    className: 'border-blue-200 bg-blue-50 text-blue-900',
  },
  warning: {
    label: 'Varning',
    icon: AlertTriangle,
    className: 'border-amber-200 bg-amber-50 text-amber-900',
  },
}

interface CalloutProps {
  type: CalloutType
  children: React.ReactNode
  className?: string
}

/** Highlighted note inside a guide step: Tips, Obs or Varning. */
export function Callout({ type, children, className }: CalloutProps) {
  const { label, icon: Icon, className: typeClassName } = CALLOUT_STYLES[type]

  return (
    <div
      role="note"
      className={cn(
        'flex gap-3 rounded-lg border p-3 text-sm',
        typeClassName,
        className
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
      <div>
        <span className="font-semibold">{label}: </span>
        {children}
      </div>
    </div>
  )
}
