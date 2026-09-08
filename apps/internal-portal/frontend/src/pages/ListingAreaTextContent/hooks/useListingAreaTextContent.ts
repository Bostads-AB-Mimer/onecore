import axios, { AxiosError } from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leasing } from '@onecore/types'
import { z } from 'zod'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

type ListingAreaTextContent = z.infer<
  typeof leasing.v1.ListingAreaTextContentSchema
>
type CreateListingAreaTextContentRequest = z.infer<
  typeof leasing.v1.CreateListingAreaTextContentRequestSchema
>
type UpdateListingAreaTextContentRequest = z.infer<
  typeof leasing.v1.UpdateListingAreaTextContentRequestSchema
>

// GET - Fetch all market-area text templates
export const useListingAreaTextContents = () =>
  useQuery<ListingAreaTextContent[], AxiosError>({
    queryKey: ['listingAreaTextContent'],
    queryFn: () =>
      axios
        .get(`${backendUrl}/listing-area-text-content`, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .then((res) => res.data.content),
  })

// GET - Fetch a single market-area text template by market area code
export const useListingAreaTextContent = (marketAreaCode?: string) =>
  useQuery<ListingAreaTextContent, AxiosError>({
    queryKey: ['listingAreaTextContent', marketAreaCode],
    queryFn: () =>
      axios
        .get(
          `${backendUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode ?? '')}`,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .then((res) => res.data.content),
    enabled: !!marketAreaCode,
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401 || error.response?.status === 404) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })

// POST - Create new market-area text template
export const useCreateListingAreaTextContent = () => {
  const queryClient = useQueryClient()
  return useMutation<
    ListingAreaTextContent,
    AxiosError,
    CreateListingAreaTextContentRequest
  >({
    mutationFn: (data: CreateListingAreaTextContentRequest) =>
      axios
        .post<{ content: ListingAreaTextContent }>(
          `${backendUrl}/listing-area-text-content`,
          data,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .then((res) => res.data.content),
    onSuccess: (data) => {
      // The create form looked this code up (404) before saving; seed the
      // cache so the edit page does not flash an error before the refetch.
      queryClient.setQueryData(
        ['listingAreaTextContent', data.marketAreaCode],
        data
      )
      queryClient.invalidateQueries({
        queryKey: ['listingAreaTextContent'],
      })
    },
  })
}

// PUT - Update existing market-area text template
export const useUpdateListingAreaTextContent = () => {
  const queryClient = useQueryClient()
  return useMutation<
    ListingAreaTextContent,
    AxiosError,
    { marketAreaCode: string; data: UpdateListingAreaTextContentRequest }
  >({
    mutationFn: ({ marketAreaCode, data }) =>
      axios
        .put<{ content: ListingAreaTextContent }>(
          `${backendUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode)}`,
          data,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .then((res) => res.data.content),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['listingAreaTextContent', data.marketAreaCode],
        data
      )
      queryClient.invalidateQueries({
        queryKey: ['listingAreaTextContent'],
      })
    },
  })
}

// DELETE - Remove market-area text template
export const useDeleteListingAreaTextContent = () => {
  const queryClient = useQueryClient()
  return useMutation<null, AxiosError, { marketAreaCode: string }>({
    mutationFn: ({ marketAreaCode }) =>
      axios
        .delete(
          `${backendUrl}/listing-area-text-content/${encodeURIComponent(marketAreaCode)}`,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .then(() => null),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['listingAreaTextContent'],
      })
      queryClient.removeQueries({
        queryKey: ['listingAreaTextContent', variables.marketAreaCode],
      })
    },
  })
}
