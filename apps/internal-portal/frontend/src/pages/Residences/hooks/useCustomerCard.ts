import { AxiosError } from 'axios'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { Contact, schemas } from 'onecore-types'
import { z } from 'zod'

import apiClient from '../../../utils/api-client'

export type CustomerCard = {
  applicationProfile: z.infer<typeof schemas.v1.ApplicationProfileSchema>
  contact: Contact
}

export const useCustomerCard = (
  contactCode?: string
): UseQueryResult<CustomerCard, AxiosError> =>
  useQuery<CustomerCard, AxiosError>({
    queryKey: ['customer-card', contactCode],
    enabled: Boolean(contactCode),
    queryFn: async () => {
      return await apiClient
        .get(`/contacts/${contactCode}/application-profile`)
        .then((response) => response.data.content)
    },
    retry: (failureCount: number, error: AxiosError) =>
      error.response?.status === 401 || error.response?.status === 500
        ? false
        : failureCount < 3,
  })
