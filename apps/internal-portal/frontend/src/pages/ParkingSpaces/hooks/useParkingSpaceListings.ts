import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import {
  GetListingWithApplicantFilterByType,
  Listing,
  Offer,
} from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export type ListingWithOffer = Listing & { offer: Offer | null }

export const useParkingSpaceListings = (
  type: GetListingWithApplicantFilterByType
) =>
  useQuery<Array<ListingWithOffer>, AxiosError>({
    queryKey: ['parkingSpaceListings', type],
    queryFn: () =>
      axios
        .get(`${backendUrl}/listings/with-applicants?type=${type}`, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .then((res) => res.data.content),
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
