import axios, { AxiosError } from 'axios'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  DetailedApplicant,
  Listing,
  OfferWithOfferApplicants,
} from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface ParkingSpaceListing {
  [key: string]: any
}

type Params = { id: number }

type ResultType = Listing & {
  applicants: Array<DetailedApplicant>
  offers: Array<OfferWithOfferApplicants>
}

export const useParkingSpaceListing = (params: Params) =>
  useSuspenseQuery<ResultType, AxiosError>({
    queryKey: ['parkingSpaceListing', params.id],
    queryFn: () =>
      axios
        .get<{ content: ResultType }>(
          `${backendUrl}/listings/with-applicants/${params.id}`,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .then((res) => res.data.content),
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
