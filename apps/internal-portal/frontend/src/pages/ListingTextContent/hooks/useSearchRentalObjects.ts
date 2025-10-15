import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface RentalObjectSearchData {
  rentalObjectCode: string
  address?: string
  type?: string
}

export const useSearchRentalObjects = (q: string) =>
  useQuery<RentalObjectSearchData, AxiosError>({
    queryKey: ['search-rental-objects', q],
    enabled: Boolean(q?.length >= 1),
    queryFn: () =>
      axios
        .get(`${backendUrl}/rental-objects/by-code/${q}`, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .then((res) => res.data.content),
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401 || error.response?.status === 404) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
