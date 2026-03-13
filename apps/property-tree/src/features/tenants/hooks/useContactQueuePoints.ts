import { useQuery } from '@tanstack/react-query'

import { GET } from '@/services/api/core/baseApi'

export interface WaitingListData {
  queuePoints: number
  queueTime: string
  type: string
}

export interface ContactQueuePoints {
  parking?: WaitingListData
  housing?: WaitingListData
  storage?: WaitingListData
}

/**
 * Hook to fetch queue points (parking, housing, storage) for a contact
 * This is a fast call that returns immediately
 *
 * @param contactCode - The tenant's contact code
 * @returns Query result with queue points, loading state, and error
 */
export function useContactQueuePoints(contactCode: string | undefined) {
  return useQuery<ContactQueuePoints, Error>({
    queryKey: ['contactQueuePoints', contactCode],
    queryFn: async () => {
      if (!contactCode) {
        throw new Error('Contact code is required')
      }

      const { data: contactData, error: contactError } = await GET(
        '/contacts/{contactCode}',
        {
          params: { path: { contactCode } },
        }
      )

      if (contactError) {
        console.error('Error fetching contact data:', contactError)
        throw new Error('Failed to fetch contact data')
      }

      const contact = contactData?.content as any

      const parkingQueue = contact?.parkingSpaceWaitingList
        ? {
            queuePoints: contact.parkingSpaceWaitingList.queuePoints,
            queueTime: contact.parkingSpaceWaitingList.queueTime,
            type: contact.parkingSpaceWaitingList.type,
          }
        : undefined

      const housingQueue = contact?.housingWaitingList
        ? {
            queuePoints: contact.housingWaitingList.queuePoints,
            queueTime: contact.housingWaitingList.queueTime,
            type: contact.housingWaitingList.type,
          }
        : undefined

      const storageQueue = contact?.storageWaitingList
        ? {
            queuePoints: contact.storageWaitingList.queuePoints,
            queueTime: contact.storageWaitingList.queueTime,
            type: contact.storageWaitingList.type,
          }
        : undefined

      return {
        parking: parkingQueue,
        housing: housingQueue,
        storage: storageQueue,
      }
    },
    enabled: !!contactCode,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2,
  })
}
