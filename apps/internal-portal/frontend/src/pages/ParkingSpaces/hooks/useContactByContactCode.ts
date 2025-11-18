import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Tenant } from '@onecore/types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export const useContactByContactCode = <T = Tenant>(contactCode?: string) =>
  useQuery<T, AxiosError>({
    queryKey: ['contact', contactCode],
    enabled: Boolean(contactCode),
    queryFn: () =>
      axios
        .get(`${backendUrl}/contacts/${contactCode}`, {
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
