import { useState } from 'react'

import type { GuideCategoryGroup } from '@/entities/guide'

type CategoryRef = Pick<GuideCategoryGroup, 'id' | 'name'>

/** A subcategory keeps its parent so going back returns to it. */
export type SheetCategory = CategoryRef & { parent?: CategoryRef }

/**
 * Which category the guide sheet's overview is showing. Kept in the sheet
 * rather than the sheet context so going back from a guide returns to its
 * category.
 */
export function useSheetCategory({
  isOpen,
  slug,
}: {
  isOpen: boolean
  slug: string | null
}) {
  const [category, setCategory] = useState<SheetCategory | null>(null)
  // The guide last opened from the category list.
  const [listedSlug, setListedSlug] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(isOpen)

  // State is adjusted during render rather than in effects, so the sheet
  // never paints a stale category first.
  // Reset when the sheet opens rather than when it closes, so the content
  // does not change while the sheet animates out.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen && category !== null) setCategory(null)
  }
  // Any other guide was opened from outside the list (e.g. a contextual "?"
  // button) and may belong to another category, so going back shows all.
  if (slug !== null && slug !== listedSlug && category !== null) {
    setCategory(null)
  }

  return {
    category,
    selectCategory: setCategory,
    /** Back to the parent category, or to all categories. */
    leaveCategory: () => setCategory(category?.parent ?? null),
    /** Call before opening a guide from the list to keep its category. */
    markGuideListed: setListedSlug,
  }
}
