import axios, { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'

import { ContactSearchData } from '../components/create-applicant-for-listing/types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export const useSearchContacts = (q: string) =>
  useQuery<Array<ContactSearchData>, AxiosError>({
    queryKey: ['search-contacts', q],
    enabled: Boolean(q?.length >= 3),
    queryFn: () =>
      axios
        .get(`${backendUrl}/contacts?q=${q}`, {
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
