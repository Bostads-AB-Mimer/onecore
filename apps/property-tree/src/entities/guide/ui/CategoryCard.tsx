import { ChevronRight, FolderOpen } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { paths } from '@/shared/routes'
import { Card, CardContent } from '@/shared/ui/Card'

import type { GuideCategoryGroup } from '../lib/groupByCategory'
import { SelectableCardLink } from './SelectableCardLink'

interface CategoryCardProps {
  category: GuideCategoryGroup
  /** Override navigation, e.g. to open the category inside a sheet. */
  onSelect?: (category: GuideCategoryGroup) => void
  className?: string
}

export function CategoryCard({
  category,
  onSelect,
  className,
}: CategoryCardProps) {
  const count = category.guides.length
  const content = (
    <Card
      className={cn(
        'h-full transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring',
        className
      )}
    >
      <CardContent className="p-4 flex items-center gap-3 h-full">
        <FolderOpen
          className="h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-snug">{category.name}</h3>
          <p className="text-sm text-muted-foreground">
            {count === 1 ? '1 guide' : `${count} guider`}
          </p>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </CardContent>
    </Card>
  )

  return (
    <SelectableCardLink
      href={paths.guideCategory(category.id)}
      onSelect={onSelect && (() => onSelect(category))}
    >
      {content}
    </SelectableCardLink>
  )
}
