import type { GuideCategory } from '@/entities/guide'

import type { EditorCategory } from './editorState'

// Sentinel select value that reveals a "new category" name field.
export const NEW_CATEGORY = '__new__'
// Sentinel select value for a guide placed directly in its category.
export const NO_SUBCATEGORY = '__none__'

/**
 * Split the editor's category, which names the most specific category, into
 * the values of the category and subcategory selects. A saved guide in a
 * subcategory arrives as just its id, so the parent is looked up in
 * `categories`.
 */
export function splitCategory(
  value: EditorCategory | null,
  categories: readonly GuideCategory[]
): { category: string; subcategory: string } {
  if (value === null) return { category: '', subcategory: NO_SUBCATEGORY }
  if ('name' in value) {
    return value.parentId
      ? { category: value.parentId, subcategory: NEW_CATEGORY }
      : { category: NEW_CATEGORY, subcategory: NO_SUBCATEGORY }
  }
  const parentId = categories.find(({ id }) => id === value.id)?.parentId
  return parentId
    ? { category: parentId, subcategory: value.id }
    : { category: value.id, subcategory: NO_SUBCATEGORY }
}

/** The editor category for a choice in the subcategory select. */
export function chooseSubcategory(
  parentId: string,
  choice: string
): EditorCategory {
  if (choice === NO_SUBCATEGORY) return { id: parentId }
  if (choice === NEW_CATEGORY) return { name: '', parentId }
  return { id: choice }
}
