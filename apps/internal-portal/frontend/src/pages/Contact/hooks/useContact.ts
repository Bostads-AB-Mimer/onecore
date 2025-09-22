import { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Contact, Invoice } from '@onecore/types'

import apiClient from '../../../utils/api-client'

type ContactResponse = Contact & { invoices: Invoice[] }

export const useContact = (contactCode: string) => {
  return useQuery<ContactResponse, AxiosError>({
    queryKey: ['contact', contactCode],
    queryFn: () =>
      apiClient
        .get<{ content: ContactResponse }>(`/contact-cards/${contactCode}`, {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer sometoken',
          },
          withCredentials: true,
        })
        .then((res) => res.data.content),
    refetchOnWindowFocus: false,
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })
}
