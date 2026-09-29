import type { GuideSummary } from '../types'

export interface GuideCategoryGroup {
  id: string
  name: string
  guides: GuideSummary[]
}

/**
 * Group summaries by category, keeping the API's order (category name, then
 * title) so the overview reads the same as the backend sorts it.
 */
export function groupByCategory(guides: GuideSummary[]): GuideCategoryGroup[] {
  const groups = new Map<string, GuideCategoryGroup>()

  for (const guide of guides) {
    const existing = groups.get(guide.category.id)
    if (existing) {
      existing.guides.push(guide)
    } else {
      groups.set(guide.category.id, {
        id: guide.category.id,
        name: guide.category.name,
        guides: [guide],
      })
    }
  }

  return [...groups.values()]
}
