import { Badge } from '@/shared/ui/Badge'

import type { GuideSummary } from '../types'

/** One badge per category the guide is listed under. */
export function GuideCategoryBadges({ guide }: { guide: GuideSummary }) {
  return (
    <>
      {guide.categories.map((category) => (
        <Badge key={category.id} variant="outline">
          {category.name}
        </Badge>
      ))}
    </>
  )
}
