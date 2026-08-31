import { useQuery } from '@tanstack/react-query'

import { roomService } from '@/services/api/core'

export function useRooms(
  params:
    | { rentalId: string; roomCode?: string; facilityId?: never }
    | { rentalId?: never; roomCode?: never; facilityId: string }
) {
  const id = params.rentalId ?? params.facilityId
  const queryFn = params.rentalId
    ? () => roomService.getByRentalId(params.rentalId, params.roomCode)
    : () => roomService.getByFacilityId(params.facilityId!)

  return useQuery({
    queryKey: ['rooms', id, params.roomCode],
    queryFn,
    enabled: !!id,
  })
}
