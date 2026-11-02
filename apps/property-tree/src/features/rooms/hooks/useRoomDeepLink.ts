import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import type { components } from '@/services/api/core/generated/api-types'

type Room = components['schemas']['Room']

/**
 * Keeps the open room in the `room` search param, so a link or a remount
 * opens the same room. Scrolls to the room named in the URL on first load.
 *
 * The param holds the room code, or the room id when another room in the list
 * shares the code. `rooms` must list active rooms before deleted ones, so a
 * bare code opens the active room.
 */
export const useRoomDeepLink = (rooms: Room[]) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const roomParam = searchParams.get('room')
  const initialRoomParam = useRef(roomParam)
  const roomRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const openRoom =
    rooms.find((r) => r.id === roomParam) ??
    rooms.find((r) => r.code === roomParam)
  const openRoomId = openRoom?.id ?? ''

  useEffect(() => {
    if (!openRoom || roomParam !== initialRoomParam.current) return
    initialRoomParam.current = null
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        roomRefs.current
          .get(openRoom.id)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }, [openRoom, roomParam])

  const setOpenRoomId = useCallback(
    (roomId: string) => {
      const code = rooms.find((r) => r.id === roomId)?.code
      const codeIsShared = rooms.filter((r) => r.code === code).length > 1
      const param = code && codeIsShared ? roomId : code
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (param) next.set('room', param)
          else next.delete('room')
          return next
        },
        { replace: true, state: location.state }
      )
    },
    [rooms, setSearchParams, location.state]
  )

  return { openRoomId, setOpenRoomId, roomRefs }
}
