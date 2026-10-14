import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { components } from '@/services/api/core/generated/api-types'

type Room = components['schemas']['Room']

/**
 * Keeps the open room in the `room` search param, so a link or a remount
 * opens the same room. Scrolls to the room named in the URL on first load.
 */
export function useRoomDeepLink(rooms: Room[]) {
  const [searchParams, setSearchParams] = useSearchParams()
  const roomCode = searchParams.get('room')
  const initialRoomCode = useRef(roomCode)
  const roomRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const openRoom = rooms.find((r) => r.code === roomCode)
  const openRoomId = openRoom?.id ?? ''

  useEffect(() => {
    if (!openRoom || openRoom.code !== initialRoomCode.current) return
    initialRoomCode.current = null
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        roomRefs.current
          .get(openRoom.id)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }, [openRoom])

  const setOpenRoomId = useCallback(
    (roomId: string) => {
      const code = rooms.find((r) => r.id === roomId)?.code
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (code) next.set('room', code)
          else next.delete('room')
          return next
        },
        { replace: true }
      )
    },
    [rooms, setSearchParams]
  )

  return { openRoomId, setOpenRoomId, roomRefs }
}
