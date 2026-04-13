import { useQuery } from '@tanstack/react-query'

import { componentService } from '@/services/api/core/componentService'

// NOTE: the endpoint is named `roomId` but actually expects a propertyObjectId.
// componentInstallations.spaceId stores propertyObject IDs (rooms, buildings,
// stairwells, etc.), so callers must pass `room.propertyObjectId`.
export function useRoomComponents(propertyObjectId: string | undefined) {
  return useQuery({
    queryKey: ['components', 'by-room', propertyObjectId],
    queryFn: () => componentService.getByRoomId(propertyObjectId!),
    enabled: Boolean(propertyObjectId),
  })
}
