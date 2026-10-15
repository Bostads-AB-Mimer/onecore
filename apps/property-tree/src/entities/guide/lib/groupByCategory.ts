import type { GuideCategory, GuideSummary } from '../types'

export interface GuideCategoryGroup {
  id: string
  name: string
  guides: GuideSummary[]
}

/**
 * Group summaries under the category `groupOf` returns, in first-seen order.
 * Guides it returns null for are left out.
 */
function groupGuides(
  guides: GuideSummary[],
  groupOf: (guide: GuideSummary) => { id: string; name: string } | null
): GuideCategoryGroup[] {
  const groups = new Map<string, GuideCategoryGroup>()

  for (const guide of guides) {
    const group = groupOf(guide)
    if (!group) continue
    const existing = groups.get(group.id)
    if (existing) {
      existing.guides.push(guide)
    } else {
      groups.set(group.id, { id: group.id, name: group.name, guides: [guide] })
    }
  }

  return [...groups.values()]
}

/**
 * Group summaries by top-level category, keeping the API's order (top-level
 * category, subcategory, then title) so the overview reads the same as the
 * backend sorts it. A guide in a subcategory counts towards its parent, whose
 * name is looked up in `categories`.
 */
export function groupByCategory(
  guides: GuideSummary[],
  categories: readonly GuideCategory[] = []
): GuideCategoryGroup[] {
  return groupGuides(guides, ({ category }) =>
    category.parentId === null
      ? category
      : {
          id: category.parentId,
          name:
            categories.find(({ id }) => id === category.parentId)?.name ?? '',
        }
  )
}

/** Group the guides in subcategories of `parentId` by subcategory. */
export function groupBySubcategory(
  guides: GuideSummary[],
  parentId: string
): GuideCategoryGroup[] {
  return groupGuides(guides, ({ category }) =>
    category.parentId === parentId ? category : null
  )
}
