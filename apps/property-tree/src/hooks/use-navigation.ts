import { useState, useCallback } from 'react'
import { NavigationItem } from '@/services/types'
import { fetchApi } from '@/services/api/baseApi'

/**
 * Custom hook för att hantera navigationstillstånd och logik
 * @param onItemSelected Callback som körs när en item väljs
 */
export function useNavigation(onItemSelected?: (item: NavigationItem) => void) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)

  const handleExpand = useCallback(async (item: NavigationItem) => {
    if (!expanded.has(item.id)) {
      try {
        let childrenUrl: string | undefined

        switch (item.type) {
          case 'company':
            childrenUrl = item._links?.properties?.href
            break
          case 'property':
            childrenUrl = item._links?.buildings?.href
            break
          case 'building':
            childrenUrl = item._links?.staircases?.href
            break
          case 'staircase':
            childrenUrl = item._links?.residences?.href
            break
        }

        if (childrenUrl) {
          const response = await fetchApi<{ content: NavigationItem[] }>(childrenUrl)
          return response.content
        }
      } catch (err) {
        console.error(`Kunde inte ladda barn för ${item.type} ${item.id}:`, err)
        throw err
      }
    }
    return []
  }, [expanded])

  const toggleExpanded = useCallback((itemId: string) => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  const handleSelect = useCallback((item: NavigationItem) => {
    setSelected(item.id)
    onItemSelected?.(item)
  }, [onItemSelected])

  return {
    expanded,
    selected,
    handleExpand,
    toggleExpanded,
    handleSelect
  }
}
