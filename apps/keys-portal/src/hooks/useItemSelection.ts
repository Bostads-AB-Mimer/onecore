import { useState, useCallback, useMemo } from 'react'

export interface UseItemSelectionOptions {
  initialSelection?: string[]
  onSelectionChange?: (selectedIds: string[]) => void
}

export interface UseItemSelectionReturn {
  selectedIds: string[]
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  select: (id: string) => void
  deselect: (id: string) => void
  selectAll: (ids: string[]) => void
  deselectAll: () => void
  toggleAll: (ids: string[]) => void
  areAllSelected: (ids: string[]) => boolean
  areSomeSelected: (ids: string[]) => boolean
}

/** Hook for managing item selection state in tables */
export function useItemSelection(
  options: UseItemSelectionOptions = {}
): UseItemSelectionReturn {
  const { initialSelection = [], onSelectionChange } = options

  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const updateSelection = useCallback(
    (newIds: string[]) => {
      setSelectedIds(newIds)
      onSelectionChange?.(newIds)
    },
    [onSelectionChange]
  )

  const isSelected = useCallback(
    (id: string): boolean => selectedSet.has(id),
    [selectedSet]
  )

  const select = useCallback(
    (id: string) => {
      if (!selectedSet.has(id)) {
        updateSelection([...selectedIds, id])
      }
    },
    [selectedSet, selectedIds, updateSelection]
  )

  const deselect = useCallback(
    (id: string) => {
      if (selectedSet.has(id)) {
        updateSelection(selectedIds.filter((selectedId) => selectedId !== id))
      }
    },
    [selectedSet, selectedIds, updateSelection]
  )

  const toggle = useCallback(
    (id: string) => {
      if (selectedSet.has(id)) {
        deselect(id)
      } else {
        select(id)
      }
    },
    [selectedSet, select, deselect]
  )

  const selectAll = useCallback(
    (ids: string[]) => {
      const newSet = new Set(selectedIds)
      ids.forEach((id) => newSet.add(id))
      updateSelection(Array.from(newSet))
    },
    [selectedIds, updateSelection]
  )

  const deselectAll = useCallback(() => {
    updateSelection([])
  }, [updateSelection])

  const areAllSelected = useCallback(
    (ids: string[]): boolean => {
      if (ids.length === 0) return false
      return ids.every((id) => selectedSet.has(id))
    },
    [selectedSet]
  )

  const areSomeSelected = useCallback(
    (ids: string[]): boolean => {
      if (ids.length === 0) return false
      const selectedCount = ids.filter((id) => selectedSet.has(id)).length
      return selectedCount > 0 && selectedCount < ids.length
    },
    [selectedSet]
  )

  const toggleAll = useCallback(
    (ids: string[]) => {
      if (areAllSelected(ids)) {
        // Deselect all provided IDs
        updateSelection(selectedIds.filter((id) => !ids.includes(id)))
      } else {
        // Select all provided IDs
        selectAll(ids)
      }
    },
    [areAllSelected, selectedIds, selectAll, updateSelection]
  )

  return {
    selectedIds,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    deselectAll,
    toggleAll,
    areAllSelected,
    areSomeSelected,
  }
}
