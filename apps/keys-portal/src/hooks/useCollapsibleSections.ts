import { useState, useCallback, useMemo } from 'react'

export interface UseCollapsibleSectionsOptions {
  initialExpanded?: 'all' | 'none' | string[] // 'all' = start expanded, 'none' = start collapsed
}

export interface UseCollapsibleSectionsReturn {
  expandedSections: Set<string>
  isExpanded: (sectionId: string) => boolean
  toggle: (sectionId: string, allSectionIds?: string[]) => void
  expand: (sectionId: string) => void
  collapse: (sectionId: string) => void
  expandAll: (sectionIds: string[]) => void
  collapseAll: () => void
  setExpanded: (sectionIds: string[]) => void
}

/** Hook for managing collapsible sections in tables with multi-level grouping */
export function useCollapsibleSections(
  options: UseCollapsibleSectionsOptions = {}
): UseCollapsibleSectionsReturn {
  const { initialExpanded = 'all' } = options

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    if (initialExpanded === 'none') return new Set()
    if (initialExpanded === 'all') return new Set() // populated when sections are known
    return new Set(initialExpanded)
  })

  const [defaultExpandAll] = useState(initialExpanded === 'all')
  const [hasInteracted, setHasInteracted] = useState(false)

  const isExpanded = useCallback(
    (sectionId: string): boolean => {
      // In default "all" mode before any interaction, treat all as expanded
      if (defaultExpandAll && !hasInteracted) return true
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
    (sectionId: string, allSectionIds?: string[]) => {
      const wasExpanded = isExpanded(sectionId)

      // First interaction in "all expanded" mode: populate set with all except the collapsed one
      if (defaultExpandAll && !hasInteracted && wasExpanded && allSectionIds) {
        setHasInteracted(true)
        setExpandedSections(
          new Set(allSectionIds.filter((id) => id !== sectionId))
        )
        return
      }

      if (wasExpanded) collapse(sectionId)
      else expand(sectionId)
    },
    [isExpanded, expand, collapse, defaultExpandAll, hasInteracted]
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
