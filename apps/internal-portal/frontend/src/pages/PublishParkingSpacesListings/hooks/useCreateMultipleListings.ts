import axios, { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Listing, ListingStatus } from '@onecore/types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

interface CreateMultipleListingsParams {
  rentalObjectCodes: string[]
  rentalRule?: 'SCORED' | 'NON_SCORED'
}

interface CreateMultipleListingsRequest {
  listings: Array<{
    rentalObjectCode: string
    publishedFrom: string
    publishedTo?: string
    status: ListingStatus
    rentalRule: 'SCORED' | 'NON_SCORED'
    listingCategory: 'PARKING_SPACE'
  }>
}

interface CreateMultipleListingsResponse {
  content: Array<Listing>
  message: string
}

interface CreateMultipleListingsError {
  error: string
  message?: string
}

export const useCreateMultipleListings = () => {
  const queryClient = useQueryClient()

  return useMutation<
    CreateMultipleListingsResponse,
    AxiosError<CreateMultipleListingsError>,
    CreateMultipleListingsParams
  >({
    mutationFn: async (params: CreateMultipleListingsParams) => {
      // Create listing objects from rental object codes
      const now = new Date()
      const publishedFrom = now.toISOString()

      // Calculate publishedTo based on rental rule
      // SCORED: 1 week from publishedFrom
      // NON_SCORED: undefined (no end date)
      const publishedTo =
        params.rentalRule === 'SCORED'
          ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 1 week from now
          : undefined

      const listingsRequest: CreateMultipleListingsRequest = {
        listings: params.rentalObjectCodes.map((rentalObjectCode) => {
          const listing: any = {
            rentalObjectCode,
            publishedFrom,
            status: ListingStatus.Active,
            rentalRule: params.rentalRule || 'SCORED',
            listingCategory: 'PARKING_SPACE' as const,
          }

          // Only add publishedTo if it's defined
          if (publishedTo) {
            listing.publishedTo = publishedTo
          }

          return listing
        }),
      }

      const response = await axios.post<CreateMultipleListingsResponse>(
        `${backendUrl}/listings/batch`,
        listingsRequest,
        {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        }
      )

      return response.data
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ['parkingSpaceListings'],
      })
      queryClient.invalidateQueries({
        queryKey: ['vacantParkingSpaces'],
      })
    },
  })
}
