import type { GuideSummary } from '../types'

/** Case-insensitive match on title, description and category name. */
export function filterGuides(
  guides: GuideSummary[],
  search: string
): GuideSummary[] {
  const needle = search.trim().toLowerCase()
  if (needle.length === 0) return guides

  return guides.filter((guide) =>
    [guide.title, guide.description, guide.category.name].some((text) =>
      text.toLowerCase().includes(needle)
    )
  )
}
