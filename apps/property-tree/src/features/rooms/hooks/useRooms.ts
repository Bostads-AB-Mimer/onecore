import { useQuery } from '@tanstack/react-query'

import { roomService } from '@/services/api/core'

export function useRooms(
  params:
    | { residenceId: string; roomCode?: string; facilityId?: never }
    | { residenceId?: never; roomCode?: never; facilityId: string }
) {
  const id = params.residenceId ?? params.facilityId
  const queryFn = params.residenceId
    ? () => roomService.getByResidenceId(params.residenceId, params.roomCode)
    : () => roomService.getByFacilityId(params.facilityId!)

  return useQuery({
    queryKey: ['rooms', id, params.roomCode],
    queryFn,
  })
}
