import { useState, useCallback } from 'react'

export interface UseRoomInspectionReturn {
  expandedRoomIds: string[]
  toggleRoom: (roomId: string) => void
  expandRoom: (roomId: string) => void
  collapseRoom: (roomId: string) => void
  expandAll: (roomIds: string[]) => void
  collapseAll: () => void
}

export function useRoomInspection(): UseRoomInspectionReturn {
  const [expandedRoomIds, setExpandedRoomIds] = useState<string[]>([])

  /**
   * Toggle a room's expanded state
   */
  const toggleRoom = useCallback((roomId: string) => {
    setExpandedRoomIds((prev) => {
      if (prev.includes(roomId)) {
        return prev.filter((id) => id !== roomId)
      }
      return [...prev, roomId]
    })
  }, [])

  /**
   * Expand a specific room
   */
  const expandRoom = useCallback((roomId: string) => {
    setExpandedRoomIds((prev) => {
      if (prev.includes(roomId)) return prev
      return [...prev, roomId]
    })
  }, [])

  /**
   * Collapse a specific room
   */
  const collapseRoom = useCallback((roomId: string) => {
    setExpandedRoomIds((prev) => prev.filter((id) => id !== roomId))
  }, [])

  /**
   * Expand all rooms
   */
  const expandAll = useCallback((roomIds: string[]) => {
    setExpandedRoomIds(roomIds)
  }, [])

  /**
   * Collapse all rooms
   */
  const collapseAll = useCallback(() => {
    setExpandedRoomIds([])
  }, [])

  return {
    expandedRoomIds,
    toggleRoom,
    expandRoom,
    collapseRoom,
    expandAll,
    collapseAll,
  }
}
