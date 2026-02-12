import type { components } from '@/services/api/core/generated/api-types'

type Room = components['schemas']['Room']

export const getRoomDisplayName = (room: Room): string =>
  room.name || room.roomType?.name || room.code
