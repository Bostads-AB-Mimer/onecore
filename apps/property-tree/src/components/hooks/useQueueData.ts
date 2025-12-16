import { useQuery } from '@tanstack/react-query'
import { queueService } from '@/services/api/core/queueService'
import type { QueueData } from '@/services/types'

/**
 * Hook to fetch comprehensive queue data for a tenant
 * Includes parking queue, interest applications, and housing references
 *
 * @param contactCode - The tenant's contact code
 * @returns Query result with queue data, loading state, and error
 */
export function useQueueData(contactCode: string | undefined) {
  return useQuery<QueueData, Error>({
    queryKey: ['queueData', contactCode],
    queryFn: () => {
      if (!contactCode) {
        throw new Error('Contact code is required')
      }
      return queueService.getQueueData(contactCode)
    },
    enabled: !!contactCode,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2,
  })
}
