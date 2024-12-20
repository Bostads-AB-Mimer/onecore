import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavigationItem } from '@/services/types'
import { fetchApi } from '@/services/api/baseApi'

/**
 * Custom hook för att hantera navigationstillstånd och logik
 * @param onItemSelected Callback som körs när en item väljs
 */
export function useNavigation(onItemSelected?: (item: NavigationItem) => void) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)

  const handleExpand = useCallback(async (item: NavigationItem) => {
    if (!expanded.has(item.id)) {
      const linkMap = {
        company: 'properties',
        property: 'buildings',
        building: 'staircases',
        staircase: 'residences'
      } as const

      const childrenLink = item._links?.[linkMap[item.type]]?.href
      
      if (childrenLink) {
        try {
          const response = await fetchApi<{ content: NavigationItem[] }>(childrenLink)
          return response.content
        } catch (err) {
          console.error(`Kunde inte ladda ${linkMap[item.type]} för ${item.type} ${item.id}:`, err)
          throw new Error(`Failed to load ${linkMap[item.type]}`)
        }
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
    onItemSelected?.({
      ...item,
      metadata: {
        ...item.metadata,
        propertyId: item.metadata?.propertyId || item.id,
        buildingId: item.metadata?.buildingId || item.id,
        staircaseId: item.metadata?.staircaseId || item.id,
      },
    })
    navigate(`/${item.type}s/${item.id}`)
  }, [onItemSelected, navigate])

  return {
    expanded,
    selected,
    handleExpand,
    toggleExpanded,
    handleSelect
  }
}
