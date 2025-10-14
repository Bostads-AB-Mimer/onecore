import { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { Invoice } from '@onecore/types'

import apiClient from '../../../utils/api-client'

export type UnpaidInvoicesResponse = {
  content: Invoice[]
  ok: boolean
}

export const useUnpaidInvoices = (offset?: number, size?: number) => {
  return useQuery<UnpaidInvoicesResponse, AxiosError>({
    queryKey: ['invoices', 'unpaid', offset, size],
    queryFn: () => {
      const queryParams = new URLSearchParams()
      if (offset !== undefined) {
        queryParams.append('offset', offset.toString())
      }
      if (size !== undefined) {
        queryParams.append('size', size.toString())
      }

      const url = `/invoices/unpaid?${queryParams.toString()}`

      return apiClient
        .get<UnpaidInvoicesResponse>(url, {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer sometoken',
          },
          withCredentials: true,
        })
        .then((res) => res.data)
    },
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
