import type { UseItemSelectionReturn } from '@/hooks/useItemSelection'

import type { TableSelectionProps } from './CollapsibleGroupTable'

export interface ItemTableSelectionHeader {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
}

export interface ItemTableSelection {
  /** Pass to CollapsibleGroupTable's `selection` prop. */
  selection: TableSelectionProps
  /** Pass to loanableItemColumns(...).header(...). */
  header: ItemTableSelectionHeader
  /** Selected ids among the provided lists, split into keys vs cards. */
  selectedKeyIds: string[]
  selectedCardIds: string[]
  selectedCount: number
  clear: () => void
}

/**
 * Bridges a useItemSelection instance to the bindings the item tables need: the
 * table selection prop, the header select-all state (with indeterminate), and
 * the selected ids split into keys vs cards. Keys and cards share one selection
 * set — their id namespaces are disjoint — and the split is scoped to the ids
 * passed in, so several tables can share one selection without bleeding.
 */
export function itemTableSelection(
  selection: UseItemSelectionReturn,
  { keyIds, cardIds = [] }: { keyIds: string[]; cardIds?: string[] }
): ItemTableSelection {
  const allIds = [...keyIds, ...cardIds]
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selection.isSelected(id))
  const someSelected = allIds.some((id) => selection.isSelected(id))

  const selectedKeyIds = keyIds.filter((id) => selection.isSelected(id))
  const selectedCardIds = cardIds.filter((id) => selection.isSelected(id))

  return {
    selection: { isSelected: selection.isSelected, toggle: selection.toggle },
    header: {
      checked: allSelected ? true : someSelected ? 'indeterminate' : false,
      onCheckedChange: (checked) =>
        checked ? selection.selectAll(allIds) : selection.deselectAll(),
    },
    selectedKeyIds,
    selectedCardIds,
    selectedCount: selectedKeyIds.length + selectedCardIds.length,
    clear: selection.deselectAll,
  }
}
