import { useState, useCallback, useRef } from 'react'

export interface UseExpandableRowsOptions<T> {
  onExpand?: (id: string) => Promise<T>
  singleExpanded?: boolean // default true - only one row expanded at a time
}

export interface UseExpandableRowsReturn<T> {
  expandedId: string | null
  expandedIds: Set<string>
  isLoading: boolean
  loadedData: T | null
  toggle: (id: string) => void
  expand: (id: string) => void
  collapse: (id?: string) => void
  isExpanded: (id: string) => boolean
}

/** Hook for managing expandable table rows with async data loading */
export function useExpandableRows<T = unknown>(
  options: UseExpandableRowsOptions<T> = {}
): UseExpandableRowsReturn<T> {
  const { onExpand, singleExpanded = true } = options

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [loadedData, setLoadedData] = useState<T | null>(null)
  const expandRequestId = useRef(0)

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
        const requestId = ++expandRequestId.current
        setIsLoading(true)
        setLoadedData(null)
        try {
          const data = await onExpand(id)
          if (expandRequestId.current !== requestId) return
          setLoadedData(data)
        } catch (error) {
          if (expandRequestId.current !== requestId) return
          console.error('Failed to load expanded row data:', error)
        } finally {
          if (expandRequestId.current === requestId) {
            setIsLoading(false)
          }
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
