import axios, { AxiosError } from 'axios'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ApplicantStatus, Listing } from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface ParkingSpaceListing {
  [key: string]: any
}

type Params = { id: string }

// TODO: This type is guessed from the detailed listing applicants data
// endpoint since there is currently no such type in onecore-types
export type ListingWithDetailedApplicants = Listing & {
  applicants: Array<{
    address: {
      city: string
      number: string
      postalCode: string
      street: string
    }
    applicationDate: string
    applicationType: string
    contactCode: string
    currentHousingContract: unknown
    id: number
    listingId: number
    name: string
    parkingSpaceContracts: unknown
    queuePoints: number
    status: ApplicantStatus
    upcomingHousingContracts: unknown
  }>
}

export const useParkingSpaceListing = (params: Params) =>
  useSuspenseQuery<ListingWithDetailedApplicants, AxiosError>({
    queryKey: ['parkingSpaceListing', params.id],
    queryFn: () =>
      axios
        .get<ListingWithDetailedApplicants>(
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
