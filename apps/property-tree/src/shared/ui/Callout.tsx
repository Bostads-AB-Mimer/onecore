import type { guides } from '@onecore/types'
import { AlertTriangle, Info, Lightbulb, type LucideIcon } from 'lucide-react'

import { CALLOUT_LABELS } from '@/shared/lib/callout'
import { cn } from '@/shared/lib/utils'

const CALLOUT_STYLES: Record<
  guides.CalloutType,
  { icon: LucideIcon; className: string }
> = {
  tip: {
    icon: Lightbulb,
    className: 'border-green-200 bg-green-50 text-green-900',
  },
  note: {
    icon: Info,
    className: 'border-blue-200 bg-blue-50 text-blue-900',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-200 bg-amber-50 text-amber-900',
  },
}

interface CalloutProps {
  type: guides.CalloutType
  children: React.ReactNode
  className?: string
}

/** Highlighted note inside a guide step: Tips, Obs or Varning. */
export function Callout({ type, children, className }: CalloutProps) {
  const { icon: Icon, className: typeClassName } = CALLOUT_STYLES[type]

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
        <span className="font-semibold">{CALLOUT_LABELS[type]}: </span>
        {children}
      </div>
    </div>
  )
}
