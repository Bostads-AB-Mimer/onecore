import axios, { AxiosError } from 'axios'
import { useQuery } from 'react-query'
import { Lease } from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface LeaseResponse {
  data: Lease | undefined
}

export const useLease = () => {
  return useQuery<LeaseResponse, AxiosError>({
    queryKey: ['lease'],
    queryFn: async () => {
      const { data } = await axios.get<LeaseResponse>(
        `${backendUrl}/my-lease`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer sometoken',
          },
          withCredentials: true,
        }
      )

      return data
    },
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
}
