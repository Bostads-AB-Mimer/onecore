import type { GuideCategory, GuideSummary } from '../types'

interface FilterOptions {
  /** Limit to one category and its subcategories. */
  categoryId?: string
  /** Names the parent of a subcategory, which a summary only holds by id. */
  categories?: readonly GuideCategory[]
}

/** True when the guide is in `categoryId` or one of its subcategories. */
const isInCategory = (guide: GuideSummary, categoryId: string) =>
  guide.categories.some(
    (category) => category.id === categoryId || category.parentId === categoryId
  )

/**
 * Case-insensitive match on title, description and the names of all the
 * guide's categories, optionally limited to one category and its
 * subcategories. A guide in a subcategory also matches its parent's name,
 * which is looked up in `categories`.
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
      : guides.filter((guide) => isInCategory(guide, categoryId))
  if (needle.length === 0) return inCategory

  const categoryNames = (guide: GuideSummary) =>
    guide.categories.flatMap(({ name, parentId }) =>
      parentId === null
        ? [name]
        : [name, categories.find(({ id }) => id === parentId)?.name ?? '']
    )

  return inCategory.filter((guide) =>
    [guide.title, guide.description, ...categoryNames(guide)].some((text) =>
      text.toLowerCase().includes(needle)
    )
  )
}
