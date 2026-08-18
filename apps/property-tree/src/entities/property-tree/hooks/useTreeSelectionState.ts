import { useCallback, useState } from 'react'

import type {
  ParentInfo,
  PropertyTreeLevel,
  PropertyTreeNode,
  PropertyTreeSelection,
} from '../model/selection'
import {
  deselectNodes,
  emptySelection,
  pruneSelection,
  rollDownSelection,
  rollUpSelection,
  selectNodes,
  toggleNode,
} from '../model/selection'

export type GetParentInfo = (parentKey: string) => ParentInfo | undefined

/**
 * Page-owned picker selection. Lives outside the panel so it survives
 * open/close and apply, and so chip removal can uncheck the matching node.
 */
export function useTreeSelectionState() {
  const [selection, setSelection] =
    useState<PropertyTreeSelection>(emptySelection)

  const toggle = useCallback(
    (node: PropertyTreeNode, getParent?: GetParentInfo) => {
      setSelection((prev) => {
        // Unchecking under a selected ancestor keeps the siblings selected.
        if (getParent) {
          const rolledDown = rollDownSelection(prev, node, getParent)
          if (rolledDown) return rolledDown
        }
        const next = toggleNode(prev, node)
        // Roll up only after an addition (the node is now selected).
        if (getParent && next.has(node.key)) {
          return rollUpSelection(next, node, getParent)
        }
        return next
      })
    },
    []
  )

  const prune = useCallback((level: PropertyTreeLevel, value: string) => {
    setSelection((prev) => pruneSelection(prev, level, value))
  }, [])

  /** Remove exactly one node. Prefer this over prune where the caller holds
   * the node: a parkeringsområde split across two fastigheter shares its
   * value with its twin, so pruning by value removes both. */
  const pruneKey = useCallback((key: string) => {
    setSelection((prev) => {
      if (!prev.has(key)) return prev
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])

  /** Drop everything — pairs with the filter bar's "Rensa alla filter". */
  const clear = useCallback(() => setSelection(emptySelection), [])

  const selectMany = useCallback(
    (nodes: PropertyTreeNode[], getParent?: GetParentInfo) => {
      setSelection((prev) => {
        let next = selectNodes(prev, nodes)
        if (getParent) {
          for (const node of nodes) {
            if (next.has(node.key)) {
              next = rollUpSelection(next, node, getParent)
            }
          }
        }
        return next
      })
    },
    []
  )

  /** Bulk uncheck ("avmarkera allt som visas"). One pass, not N toggles —
   * see deselectNodes for why the loop is wrong. */
  const deselectMany = useCallback(
    (nodes: PropertyTreeNode[], getParent?: GetParentInfo) => {
      setSelection((prev) => deselectNodes(prev, nodes, getParent))
    },
    []
  )

  return {
    selection,
    toggle,
    prune,
    pruneKey,
    clear,
    selectMany,
    deselectMany,
  }
}
