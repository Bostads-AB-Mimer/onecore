import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface Account {
  name: string
  username: string
}

export interface ProfileResponse {
  account: Account | undefined
}

export const useProfile = () => {
  return useQuery<ProfileResponse, AxiosError>({
    queryKey: ['account'],
    queryFn: async () => {
      const { data } = await axios.get<{ content: ProfileResponse }>(
        `${backendUrl}/auth/profile`,
        {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        }
      )
      return data.content
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
