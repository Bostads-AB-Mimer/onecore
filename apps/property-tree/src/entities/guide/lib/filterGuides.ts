import type { GuideCategory, GuideSummary } from '../types'

interface FilterOptions {
  /** Limit to one category and its subcategories. */
  categoryId?: string
  /** Names the parent of a subcategory, which a summary only holds by id. */
  categories?: readonly GuideCategory[]
}

/**
 * Case-insensitive match on title, description and category name, optionally
 * limited to one category and its subcategories. A guide in a subcategory
 * also matches its parent's name, which is looked up in `categories`.
 */
export function filterGuides(
  guides: GuideSummary[],
  search: string,
  { categoryId, categories = [] }: FilterOptions = {}
): GuideSummary[] {
  const needle = search.trim().toLowerCase()
  const inCategory =
    categoryId === undefined
      ? guides
      : guides.filter(
          ({ category }) =>
            category.id === categoryId || category.parentId === categoryId
        )
  if (needle.length === 0) return inCategory

  const parentName = ({ category }: GuideSummary) =>
    category.parentId === null
      ? ''
      : (categories.find(({ id }) => id === category.parentId)?.name ?? '')

  return inCategory.filter((guide) =>
    [
      guide.title,
      guide.description,
      guide.category.name,
      parentName(guide),
    ].some((text) => text.toLowerCase().includes(needle))
  )
}
