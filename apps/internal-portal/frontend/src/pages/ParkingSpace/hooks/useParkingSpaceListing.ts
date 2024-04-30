import axios, { AxiosError } from 'axios'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Listing } from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface ParkingSpaceListing {
  [key: string]: any
}

type Params = { id: string }

export const useParkingSpaceListing = (params: Params) =>
  useSuspenseQuery<Listing, AxiosError>({
    queryKey: ['parkingSpaceListing', params.id],
    queryFn: () =>
      axios
        .get<Listing>(
          `${backendUrl}/leases/listing-with-applicants/${params.id}`,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .then((res) => res.data),

    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
