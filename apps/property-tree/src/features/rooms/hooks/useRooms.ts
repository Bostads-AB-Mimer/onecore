import { useQuery } from '@tanstack/react-query'

import { roomService } from '@/services/api/core'

export function useRooms(
  params:
    | { residenceId: string; facilityId?: never }
    | { residenceId?: never; facilityId: string }
) {
  const id = params.residenceId ?? params.facilityId
  const queryFn = params.residenceId
    ? () => roomService.getByResidenceId(params.residenceId)
    : () => roomService.getByFacilityId(params.facilityId!)

  return useQuery({
    queryKey: ['rooms', id],
    queryFn,
  })
}
