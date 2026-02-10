import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { components } from '@/services/api/core/generated/api-types'

type Room = components['schemas']['Room']

/**
 * Reads the `room` search param from the URL, finds the matching room,
 * auto-opens it, and scrolls it into view.
 */
export function useRoomDeepLink(rooms: Room[]) {
  const [searchParams] = useSearchParams()
  const roomCodeFromUrl = searchParams.get('room')
  const [openRoomId, setOpenRoomId] = useState<string | undefined>(undefined)
  const roomRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (roomCodeFromUrl && rooms.length > 0) {
      const matchingRoom = rooms.find((r) => r.code === roomCodeFromUrl)
      if (matchingRoom) {
        setOpenRoomId(matchingRoom.id)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const element = roomRefs.current.get(matchingRoom.id)
            element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        })
      }
    }
  }, [roomCodeFromUrl, rooms])

  return { openRoomId, setOpenRoomId, roomRefs }
}
