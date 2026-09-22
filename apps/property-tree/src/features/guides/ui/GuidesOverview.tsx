import { useMemo, useState } from 'react'
import { BookOpen, Search, SearchX } from 'lucide-react'

import {
  filterGuides,
  groupByCategory,
  GuideCard,
  type GuideSummary,
  useGuides,
} from '@/entities/guide'

import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'

interface GuidesOverviewProps {
  includeDrafts: boolean
  variant?: 'page' | 'sheet'
  /** Override navigation, e.g. to open the guide inside a sheet. */
  onSelectGuide?: (guide: GuideSummary) => void
  /** Rendered next to the search field, e.g. a "Ny guide" button. */
  actions?: React.ReactNode
}

/** Searchable list of guides grouped by category. */
export function GuidesOverview({
  includeDrafts,
  variant = 'page',
  onSelectGuide,
  actions,
}: GuidesOverviewProps) {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError } = useGuides(includeDrafts)

  const groups = useMemo(
    () => groupByCategory(filterGuides(data ?? [], search)),
    [data, search]
  )

  const gridClassName = cn(
    'grid gap-3',
    variant === 'page' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
  )

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sök guide..."
            aria-label="Sök guide"
            className="pl-9"
          />
        </div>
        {actions}
      </div>

      {isLoading ? (
        <div className={gridClassName} aria-busy>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-destructive">
          Guiderna kunde inte hämtas. Försök igen om en stund.
        </p>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Inga guider än"
          description="När en guide publiceras dyker den upp här."
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Inga träffar"
          description={`Ingen guide matchar "${search}".`}
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`category-${group.id}`}>
              <h2
                id={`category-${group.id}`}
                className="mb-3 text-lg font-semibold"
              >
                {group.name}
              </h2>
              <div className={gridClassName}>
                {group.guides.map((guide) => (
                  <GuideCard
                    key={guide.id}
                    guide={guide}
                    onSelect={onSelectGuide}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
