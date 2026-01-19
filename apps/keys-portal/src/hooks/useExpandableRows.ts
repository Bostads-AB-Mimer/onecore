import { useState, useCallback } from 'react'

export interface UseExpandableRowsOptions<T> {
  /**
   * Async function called when a row is expanded.
   * The returned data is stored and available via `loadedData`.
   */
  onExpand?: (id: string) => Promise<T>
  /**
   * If true (default), only one row can be expanded at a time.
   * Expanding a new row will collapse the previous one.
   */
  singleExpanded?: boolean
}

export interface UseExpandableRowsReturn<T> {
  /** ID of the currently expanded row (single mode) */
  expandedId: string | null
  /** Set of expanded IDs (multi mode) */
  expandedIds: Set<string>
  /** Whether data is currently being loaded */
  isLoading: boolean
  /** The data returned from onExpand for the current expanded row */
  loadedData: T | null
  /** Toggle expand/collapse for a row */
  toggle: (id: string) => void
  /** Expand a specific row */
  expand: (id: string) => void
  /** Collapse a specific row, or all if no id provided */
  collapse: (id?: string) => void
  /** Check if a row is expanded */
  isExpanded: (id: string) => boolean
}

/**
 * Hook for managing expandable table rows with async data loading.
 *
 * @example
 * ```tsx
 * const expansion = useExpandableRows({
 *   onExpand: async (keyId) => {
 *     const [loans, bundles] = await Promise.all([
 *       keyLoanService.getByKeyId(keyId),
 *       getKeyBundlesByKeyId(keyId),
 *     ])
 *     return { loans, bundles }
 *   }
 * })
 *
 * // In render:
 * <Button onClick={() => expansion.toggle(key.id)}>
 *   {expansion.isExpanded(key.id) ? <ChevronDown /> : <ChevronRight />}
 * </Button>
 *
 * {expansion.isExpanded(key.id) && (
 *   expansion.isLoading ? <Loader /> : <Details data={expansion.loadedData} />
 * )}
 * ```
 */
export function useExpandableRows<T = unknown>(
  options: UseExpandableRowsOptions<T> = {}
): UseExpandableRowsReturn<T> {
  const { onExpand, singleExpanded = true } = options

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [loadedData, setLoadedData] = useState<T | null>(null)

  const isExpanded = useCallback(
    (id: string): boolean => {
      if (singleExpanded) {
        return expandedId === id
      }
      return expandedIds.has(id)
    },
    [singleExpanded, expandedId, expandedIds]
  )

  const expand = useCallback(
    async (id: string) => {
      if (singleExpanded) {
        setExpandedId(id)
      } else {
        setExpandedIds((prev) => new Set(prev).add(id))
      }

      if (onExpand) {
        setIsLoading(true)
        setLoadedData(null)
        try {
          const data = await onExpand(id)
          setLoadedData(data)
        } catch (error) {
          console.error('Failed to load expanded row data:', error)
          setLoadedData(null)
        } finally {
          setIsLoading(false)
        }
      }
    },
    [singleExpanded, onExpand]
  )

  const collapse = useCallback(
    (id?: string) => {
      if (singleExpanded) {
        setExpandedId(null)
        setLoadedData(null)
      } else if (id) {
        setExpandedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else {
        setExpandedIds(new Set())
      }
    },
    [singleExpanded]
  )

  const toggle = useCallback(
    (id: string) => {
      if (isExpanded(id)) {
        collapse(id)
      } else {
        expand(id)
      }
    },
    [isExpanded, expand, collapse]
  )

  return {
    expandedId,
    expandedIds,
    isLoading,
    loadedData,
    toggle,
    expand,
    collapse,
    isExpanded,
  }
}
