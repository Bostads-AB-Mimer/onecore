import { Link } from 'react-router-dom'
import { ListOrdered } from 'lucide-react'

import { formatDate } from '@/shared/lib/fileUtils'
import { cn } from '@/shared/lib/utils'
import { paths } from '@/shared/routes'
import { Badge } from '@/shared/ui/Badge'
import { Card, CardContent } from '@/shared/ui/Card'

import type { GuideSummary } from '../types'
import { GuideStatusBadge } from './GuideStatusBadge'

interface GuideCardProps {
  guide: GuideSummary
  /** Override navigation, e.g. to open the guide inside a sheet. */
  onSelect?: (guide: GuideSummary) => void
  className?: string
}

export function GuideCard({ guide, onSelect, className }: GuideCardProps) {
  const content = (
    <Card
      className={cn(
        'h-full transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring',
        className
      )}
    >
      <CardContent className="p-4 flex flex-col gap-2 h-full">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{guide.title}</h3>
          {guide.status === 'draft' && <GuideStatusBadge status="draft" />}
        </div>
        {guide.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {guide.description}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Badge variant="outline">{guide.category.name}</Badge>
          <span className="inline-flex items-center gap-1">
            <ListOrdered className="h-3.5 w-3.5" aria-hidden />
            {guide.stepCount} steg
          </span>
          <span>Uppdaterad {formatDate(guide.updatedAt)}</span>
        </div>
      </CardContent>
    </Card>
  )

  // Stays an anchor even when overridden, so the card remains a real link
  // (middle-click, open in new tab) and keeps valid markup around the card.
  if (onSelect) {
    return (
      <a
        href={paths.guide(guide.slug)}
        onClick={(event) => {
          // Let the browser handle modifier- and non-primary-button clicks so
          // the card can still be opened in a new tab or window.
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.button !== 0
          ) {
            return
          }
          event.preventDefault()
          onSelect(guide)
        }}
        className="block rounded-lg"
      >
        {content}
      </a>
    )
  }

  return (
    <Link to={paths.guide(guide.slug)} className="block rounded-lg">
      {content}
    </Link>
  )
}
