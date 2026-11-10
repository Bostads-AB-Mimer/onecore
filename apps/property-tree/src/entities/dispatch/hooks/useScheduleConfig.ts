import { useQuery } from '@tanstack/react-query'

import { communicationService } from '@/services/api/core/communicationService'

// Scheduling rules the communication service enforces (slot length, blocked
// hours, max days ahead, enabled flag). Changes only with a deploy, so a long
// stale time avoids refetching it for every modal.
export function useScheduleConfig() {
  return useQuery({
    queryKey: ['scheduleConfig'],
    queryFn: () => communicationService.getScheduleConfig(),
    staleTime: 10 * 60 * 1000,
  })
}
