import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Contact } from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export interface ContactResponse {
  data: Contact | undefined
}

export const useMaterialChoiceDetails = () => {
  return useQuery<ContactResponse, AxiosError>({
    queryKey: ['my-details'],
    queryFn: async () => {
      const { data } = await axios.get<{ content: ContactResponse }>(
        `${backendUrl}/my-details`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer sometoken',
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
