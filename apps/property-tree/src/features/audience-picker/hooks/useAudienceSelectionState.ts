import { useCallback, useState } from 'react'

import type {
  AudienceLevel,
  AudienceNode,
  AudienceSelection,
  ParentInfo,
} from '../model/selection'
import {
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
export function useAudienceSelectionState() {
  const [selection, setSelection] = useState<AudienceSelection>(emptySelection)

  const toggle = useCallback(
    (node: AudienceNode, getParent?: GetParentInfo) => {
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

  const prune = useCallback((level: AudienceLevel, value: string) => {
    setSelection((prev) => pruneSelection(prev, level, value))
  }, [])

  /** Drop everything — pairs with the filter bar's "Rensa alla filter". */
  const clear = useCallback(() => setSelection(emptySelection), [])

  const selectMany = useCallback(
    (nodes: AudienceNode[], getParent?: GetParentInfo) => {
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

  return { selection, toggle, prune, clear, selectMany }
}
