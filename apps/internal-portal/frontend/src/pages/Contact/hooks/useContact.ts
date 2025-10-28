import { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Contact, Invoice, Lease } from '@onecore/types'

import apiClient from '../../../utils/api-client'

export type ContactResponse = Contact & {
  invoices: Invoice[]
  leases: Lease[]
}

export const useContact = (contactCode: string | null) => {
  return useQuery<ContactResponse, AxiosError>({
    queryKey: ['contact', contactCode],
    enabled: Boolean(contactCode),
    queryFn: () =>
      apiClient
        .get<{ content: ContactResponse }>(
          `/contacts/${contactCode}/contact-card`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: 'Bearer sometoken',
            },
            withCredentials: true,
          }
        )
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
