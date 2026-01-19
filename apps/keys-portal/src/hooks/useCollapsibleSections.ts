import { useState, useCallback, useMemo } from 'react'

export interface UseCollapsibleSectionsOptions {
  /**
   * Initial expanded state.
   * - 'all': All sections start expanded
   * - 'none': All sections start collapsed
   * - string[]: Specific section IDs that start expanded
   */
  initialExpanded?: 'all' | 'none' | string[]
}

export interface UseCollapsibleSectionsReturn {
  /** Set of currently expanded section IDs */
  expandedSections: Set<string>
  /** Check if a section is expanded */
  isExpanded: (sectionId: string) => boolean
  /** Toggle a section's expanded state */
  toggle: (sectionId: string) => void
  /** Expand a specific section */
  expand: (sectionId: string) => void
  /** Collapse a specific section */
  collapse: (sectionId: string) => void
  /** Expand multiple sections at once */
  expandAll: (sectionIds: string[]) => void
  /** Collapse all sections */
  collapseAll: () => void
  /** Set the expanded sections to a specific list (replacing current state) */
  setExpanded: (sectionIds: string[]) => void
}

/**
 * Hook for managing collapsible sections in tables with multi-level grouping.
 *
 * @example
 * ```tsx
 * const sections = useCollapsibleSections({
 *   initialExpanded: 'all'
 * })
 *
 * // When sections are dynamically generated, expand them all:
 * useEffect(() => {
 *   sections.expandAll(allSectionIds)
 * }, [allSectionIds])
 *
 * // In render:
 * <TableRow onClick={() => sections.toggle(sectionId)}>
 *   {sections.isExpanded(sectionId) ? <ChevronDown /> : <ChevronRight />}
 *   {sectionTitle}
 * </TableRow>
 *
 * {sections.isExpanded(sectionId) && (
 *   // Render section contents
 * )}
 * ```
 */
export function useCollapsibleSections(
  options: UseCollapsibleSectionsOptions = {}
): UseCollapsibleSectionsReturn {
  const { initialExpanded = 'all' } = options

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    if (initialExpanded === 'none') {
      return new Set()
    }
    if (initialExpanded === 'all') {
      // Start with an empty set - will be populated when sections are known
      // Use expandAll() to set initial sections
      return new Set()
    }
    return new Set(initialExpanded)
  })

  // Track if we're in "all expanded" mode (default state before any toggles)
  const [defaultExpandAll] = useState(initialExpanded === 'all')
  const [hasInteracted, setHasInteracted] = useState(false)

  const isExpanded = useCallback(
    (sectionId: string): boolean => {
      // If in default "all" mode and user hasn't interacted yet,
      // treat all sections as expanded
      if (defaultExpandAll && !hasInteracted) {
        return true
      }
      return expandedSections.has(sectionId)
    },
    [expandedSections, defaultExpandAll, hasInteracted]
  )

  const expand = useCallback((sectionId: string) => {
    setHasInteracted(true)
    setExpandedSections((prev) => {
      const next = new Set(prev)
      next.add(sectionId)
      return next
    })
  }, [])

  const collapse = useCallback((sectionId: string) => {
    setHasInteracted(true)
    setExpandedSections((prev) => {
      const next = new Set(prev)
      next.delete(sectionId)
      return next
    })
  }, [])

  const toggle = useCallback(
    (sectionId: string) => {
      if (isExpanded(sectionId)) {
        collapse(sectionId)
      } else {
        expand(sectionId)
      }
    },
    [isExpanded, expand, collapse]
  )

  const expandAll = useCallback((sectionIds: string[]) => {
    setExpandedSections(new Set(sectionIds))
  }, [])

  const collapseAll = useCallback(() => {
    setHasInteracted(true)
    setExpandedSections(new Set())
  }, [])

  const setExpanded = useCallback((sectionIds: string[]) => {
    setHasInteracted(true)
    setExpandedSections(new Set(sectionIds))
  }, [])

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      expandedSections,
      isExpanded,
      toggle,
      expand,
      collapse,
      expandAll,
      collapseAll,
      setExpanded,
    }),
    [
      expandedSections,
      isExpanded,
      toggle,
      expand,
      collapse,
      expandAll,
      collapseAll,
      setExpanded,
    ]
  )
}
