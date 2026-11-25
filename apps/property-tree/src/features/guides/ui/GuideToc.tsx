import { useMemo } from 'react'

import type { GuideStepWithUrls } from '@/entities/guide'

import { useActiveHeading } from '@/shared/hooks/useActiveHeading'
import { cn } from '@/shared/lib/utils'

import { stepAnchorId } from '../lib/stepAnchor'

interface GuideTocProps {
  steps: GuideStepWithUrls[]
}

/** Sticky list of step titles that follows the reader's scroll position. */
export function GuideToc({ steps }: GuideTocProps) {
  const ids = useMemo(
    () => steps.map((_, index) => stepAnchorId(index + 1)),
    [steps]
  )
  const activeId = useActiveHeading(ids)

  return (
    <nav aria-label="Innehåll" className="sticky top-20">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Innehåll
      </p>
      <ol className="space-y-1 border-l">
        {steps.map((step, index) => {
          const id = stepAnchorId(index + 1)
          const isActive = activeId === id
          return (
            <li key={step.id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  '-ml-px block border-l-2 py-1 pl-3 text-sm transition-colors',
                  isActive
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="mr-1 tabular-nums">{index + 1}.</span>
                {step.title}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
