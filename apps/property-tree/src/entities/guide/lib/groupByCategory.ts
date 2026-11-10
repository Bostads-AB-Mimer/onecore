import type { GuideCategory, GuideSummary } from '../types'

export interface GuideCategoryGroup {
  id: string
  /** Set when the group is a subcategory. */
  parentId: string | null
  name: string
  guides: GuideSummary[]
}

type GroupKey = { id: string; name: string; parentId: string | null }

/**
 * Group summaries under every category `groupsOf` returns for them, each
 * guide at most once per group and in input order. Groups are sorted by name.
 */
function groupGuides(
  guides: GuideSummary[],
  groupsOf: (guide: GuideSummary) => GroupKey[]
): GuideCategoryGroup[] {
  const groups = new Map<string, GuideCategoryGroup>()

  for (const guide of guides) {
    for (const group of groupsOf(guide)) {
      const existing = groups.get(group.id)
      if (!existing) {
        groups.set(group.id, {
          id: group.id,
          parentId: group.parentId,
          name: group.name,
          guides: [guide],
        })
      } else if (!existing.guides.includes(guide)) {
        // A guide in a category and one of its subcategories, or in two
        // subcategories of one parent, is listed under the parent once.
        existing.guides.push(guide)
      }
    }
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}

/**
 * Group summaries by top-level category, sorted by name, keeping the API's
 * order (title) inside a group. A guide is listed under every category it
 * has. A guide in a subcategory counts towards its parent, whose name is
 * looked up in `categories`; the subcategory's own name stands in while the
 * parent is unknown, e.g. from a stale category list.
 */
export function groupByCategory(
  guides: GuideSummary[],
  categories: readonly GuideCategory[] = []
): GuideCategoryGroup[] {
  return groupGuides(guides, (guide) =>
    guide.categories.map((category) =>
      category.parentId === null
        ? category
        : {
            id: category.parentId,
            parentId: null,
            name:
              categories.find(({ id }) => id === category.parentId)?.name ??
              category.name,
          }
    )
  )
}

/** Group the guides in subcategories of `parentId` by subcategory. */
export function groupBySubcategory(
  guides: GuideSummary[],
  parentId: string
): GuideCategoryGroup[] {
  return groupGuides(guides, (guide) =>
    guide.categories.filter((category) => category.parentId === parentId)
  )
}
