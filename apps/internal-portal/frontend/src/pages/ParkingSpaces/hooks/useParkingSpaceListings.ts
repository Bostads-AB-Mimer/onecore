import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Listing } from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export const useParkingSpaceListings = () =>
  useQuery<Array<Listing>, AxiosError>({
    queryKey: ['parkingSpaceListings'],
    queryFn: () =>
      axios
        .get(`${backendUrl}/leases/listings-with-applicants`, {
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
