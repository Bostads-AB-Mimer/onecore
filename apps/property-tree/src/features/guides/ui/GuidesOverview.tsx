import { useId, useMemo, useState } from 'react'
import { BookOpen, Search, SearchX } from 'lucide-react'

import {
  CategoryCard,
  filterGuides,
  groupByCategory,
  groupBySubcategory,
  GuideCard,
  type GuideCategoryGroup,
  type GuideSummary,
  useGuideCategories,
  useGuides,
} from '@/entities/guide'

import { cn } from '@/shared/lib/utils'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { Skeleton } from '@/shared/ui/Skeleton'

interface GuidesOverviewProps {
  includeDrafts: boolean
  variant?: 'page' | 'sheet'
  /** Limit the list to one category and its subcategories. Without it, an
   * empty search shows one card per top-level category instead of every
   * guide. */
  categoryId?: string
  /** Override navigation, e.g. to open the guide inside a sheet. */
  onSelectGuide?: (guide: GuideSummary) => void
  /** Override navigation, e.g. to open the category inside a sheet. */
  onSelectCategory?: (category: GuideCategoryGroup) => void
  /** Rendered next to the search field, e.g. a "Ny guide" button. */
  actions?: React.ReactNode
}

/**
 * Searchable guide overview. Without a search it lists the top-level
 * categories; a search lists the matching guides grouped by top-level
 * category. With `categoryId` it lists that category's subcategories and its
 * own guides, and a search lists the matching guides of both.
 */
export function GuidesOverview({
  includeDrafts,
  variant = 'page',
  categoryId,
  onSelectGuide,
  onSelectCategory,
  actions,
}: GuidesOverviewProps) {
  const [search, setSearch] = useState('')
  // The guides page and the guide sheet can list guides at the same time.
  const idPrefix = useId()
  const guides = useGuides(includeDrafts)
  // Names the parent of a subcategory, which a summary only holds by id.
  const categories = useGuideCategories()
  const data = guides.data
  const isLoading = guides.isLoading || categories.isLoading
  const isError = guides.isError || categories.isError

  // Filter by category once; both the empty-category check and the search
  // work from this list.
  const inCategory = useMemo(
    () => filterGuides(data ?? [], '', categoryId),
    [data, categoryId]
  )
  const matches = useMemo(
    () => filterGuides(inCategory, search),
    [inCategory, search]
  )
  const isSearching = search.trim().length > 0

  const gridClassName = cn(
    'grid gap-3',
    variant === 'page' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'
  )

  const results = () => {
    if (isLoading) {
      return (
        <div className={gridClassName} aria-busy>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      )
    }
    if (isError) {
      return (
        <p className="py-8 text-center text-destructive">
          Guiderna kunde inte hämtas. Försök igen om en stund.
        </p>
      )
    }
    if ((data ?? []).length === 0) {
      return (
        <EmptyState
          icon={BookOpen}
          title="Inga guider än"
          description="När en guide publiceras dyker den upp här."
        />
      )
    }
    if (inCategory.length === 0) {
      return (
        <EmptyState
          icon={BookOpen}
          title="Inga guider i kategorin"
          description="När en guide i kategorin publiceras dyker den upp här."
        />
      )
    }
    if (matches.length === 0) {
      return (
        <EmptyState
          icon={SearchX}
          title="Inga träffar"
          description={`Ingen guide matchar "${search}".`}
        />
      )
    }

    if (categoryId !== undefined) {
      const subcategories = isSearching
        ? []
        : groupBySubcategory(matches, categoryId)
      // A flat list: the page or sheet heading already names the category.
      if (subcategories.length === 0) {
        return (
          <div className={gridClassName}>
            {matches.map((guide) => (
              <GuideCard
                key={guide.id}
                guide={guide}
                onSelect={onSelectGuide}
              />
            ))}
          </div>
        )
      }

      const ownGuides = matches.filter(
        (guide) => guide.category.id === categoryId
      )
      return (
        <div className="space-y-8">
          <section aria-labelledby={`${idPrefix}-subcategories`}>
            <h2
              id={`${idPrefix}-subcategories`}
              className="mb-3 text-lg font-semibold"
            >
              Underkategorier
            </h2>
            <div className={gridClassName}>
              {subcategories.map((group) => (
                <CategoryCard
                  key={group.id}
                  category={group}
                  onSelect={onSelectCategory}
                />
              ))}
            </div>
          </section>
          {ownGuides.length > 0 && (
            <section aria-labelledby={`${idPrefix}-own-guides`}>
              <h2
                id={`${idPrefix}-own-guides`}
                className="mb-3 text-lg font-semibold"
              >
                Guider
              </h2>
              <div className={gridClassName}>
                {ownGuides.map((guide) => (
                  <GuideCard
                    key={guide.id}
                    guide={guide}
                    onSelect={onSelectGuide}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )
    }

    const groups = groupByCategory(matches, categories.data)
    if (!isSearching) {
      return (
        <div className={gridClassName}>
          {groups.map((group) => (
            <CategoryCard
              key={group.id}
              category={group}
              onSelect={onSelectCategory}
            />
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-8">
        {groups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`${idPrefix}-category-${group.id}`}
          >
            <h2
              id={`${idPrefix}-category-${group.id}`}
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
    )
  }

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

      {results()}
    </div>
  )
}
