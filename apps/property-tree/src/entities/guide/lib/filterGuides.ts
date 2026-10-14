import type { GuideSummary } from '../types'

/**
 * Case-insensitive match on title, description and category name, optionally
 * limited to one category.
 */
export function filterGuides(
  guides: GuideSummary[],
  search: string,
  categoryId?: string
): GuideSummary[] {
  const needle = search.trim().toLowerCase()
  const inCategory =
    categoryId === undefined
      ? guides
      : guides.filter((guide) => guide.category.id === categoryId)
  if (needle.length === 0) return inCategory

  return inCategory.filter((guide) =>
    [guide.title, guide.description, guide.category.name].some((text) =>
      text.toLowerCase().includes(needle)
    )
  )
}
