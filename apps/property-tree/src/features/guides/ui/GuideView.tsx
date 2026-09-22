import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Link2, Pencil } from 'lucide-react'

import { GuideStatusBadge, type GuideWithUrls } from '@/entities/guide'

import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard'
import { formatDate } from '@/shared/lib/fileUtils'
import { cn } from '@/shared/lib/utils'
import { paths } from '@/shared/routes'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

import { guideLink, stepAnchorId, stepNumberFromHash } from '../lib/stepAnchor'
import { GuideStepSection } from './GuideStepSection'
import { GuideToc } from './GuideToc'

/** How long a step linked to by hash stays highlighted after scrolling. */
const HIGHLIGHT_MS = 1500

interface GuideViewProps {
  guide: GuideWithUrls
  /** 'page' shows the sticky table of contents; 'sheet' is the narrow form. */
  variant?: 'page' | 'sheet'
  canEdit?: boolean
}

export function GuideView({
  guide,
  variant = 'page',
  canEdit = false,
}: GuideViewProps) {
  const location = useLocation()
  const copy = useCopyToClipboard()
  const [highlightedStep, setHighlightedStep] = useState<number | null>(null)

  // A link to a specific step scrolls there and flashes the step so the
  // reader sees which one was meant.
  useEffect(() => {
    if (variant !== 'page') return
    const stepNumber = stepNumberFromHash(location.hash)
    if (!stepNumber) return
    const element = document.getElementById(stepAnchorId(stepNumber))
    if (!element) return

    element.scrollIntoView({ block: 'start' })
    setHighlightedStep(stepNumber)
    const timeout = window.setTimeout(
      () => setHighlightedStep(null),
      HIGHLIGHT_MS
    )
    return () => window.clearTimeout(timeout)
  }, [guide.id, location.hash, variant])

  const isPage = variant === 'page'

  return (
    <article
      className={cn(isPage && 'lg:grid lg:grid-cols-[1fr_220px] lg:gap-8')}
    >
      <div className="min-w-0">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className={cn('font-bold', isPage ? 'text-3xl' : 'text-xl')}>
              {guide.title}
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(guideLink(guide.slug))}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Kopiera länk
              </Button>
              {canEdit && isPage && (
                <Button asChild size="sm">
                  <Link to={paths.guideEdit(guide.slug)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Redigera
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {guide.description && (
            <p className="mt-2 text-muted-foreground">{guide.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{guide.category.name}</Badge>
            {guide.status === 'draft' && <GuideStatusBadge status="draft" />}
            <span>Uppdaterad {formatDate(guide.updatedAt)}</span>
            <span>av {guide.updatedBy}</span>
          </div>
        </header>

        <div className="space-y-4">
          {guide.steps.map((step, index) => (
            <GuideStepSection
              key={step.id}
              step={step}
              stepNumber={index + 1}
              variant={variant}
              highlighted={highlightedStep === index + 1}
              onCopyLink={
                isPage
                  ? (stepNumber) => copy(guideLink(guide.slug, stepNumber))
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      {isPage && guide.steps.length > 1 && (
        <aside className="hidden lg:block">
          <GuideToc steps={guide.steps} />
        </aside>
      )}
    </article>
  )
}
