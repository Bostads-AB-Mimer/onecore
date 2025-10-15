import axios, { AxiosError } from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leasing } from '@onecore/types'
import { z } from 'zod'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

type ListingTextContent = z.infer<typeof leasing.v1.ListingTextContentSchema>
type CreateListingTextContentRequest = z.infer<
  typeof leasing.v1.CreateListingTextContentRequestSchema
>
type UpdateListingTextContentRequest = z.infer<
  typeof leasing.v1.UpdateListingTextContentRequestSchema
>

// GET - Fetch listing text content by rental object code
export const useListingTextContent = (rentalObjectCode?: string) =>
  useQuery<ListingTextContent, AxiosError>({
    queryKey: ['listingTextContent', rentalObjectCode],
    queryFn: () =>
      axios
        .get(`${backendUrl}/listing-text-content/${rentalObjectCode}`, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .then((res) => res.data.content),
    enabled: !!rentalObjectCode,
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401 || error.response?.status === 404) {
        return false
      } else {
        return failureCount < 3
      }
    },
  })

// POST - Create new listing text content
export const useCreateListingTextContent = () => {
  const queryClient = useQueryClient()
  return useMutation<
    ListingTextContent,
    AxiosError,
    CreateListingTextContentRequest
  >({
    mutationFn: (data: CreateListingTextContentRequest) =>
      axios
        .post<{ content: ListingTextContent }>(
          `${backendUrl}/listing-text-content`,
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
      queryClient.invalidateQueries({
        queryKey: ['listingTextContent'],
      })
      queryClient.setQueryData(
        ['listingTextContent', data.rentalObjectCode],
        data
      )
    },
  })
}

// PUT - Update existing listing text content
export const useUpdateListingTextContent = () => {
  const queryClient = useQueryClient()
  return useMutation<
    ListingTextContent,
    AxiosError,
    { rentalObjectCode: string; data: UpdateListingTextContentRequest }
  >({
    mutationFn: ({ rentalObjectCode, data }) =>
      axios
        .put<{ content: ListingTextContent }>(
          `${backendUrl}/listing-text-content/${rentalObjectCode}`,
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
      queryClient.invalidateQueries({
        queryKey: ['listingTextContent'],
      })
      queryClient.setQueryData(
        ['listingTextContent', data.rentalObjectCode],
        data
      )
    },
  })
}

// DELETE - Remove listing text content
export const useDeleteListingTextContent = () => {
  const queryClient = useQueryClient()
  return useMutation<null, AxiosError, { rentalObjectCode: string }>({
    mutationFn: ({ rentalObjectCode }) =>
      axios
        .delete(`${backendUrl}/listing-text-content/${rentalObjectCode}`, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .then(() => null),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['listingTextContent'],
      })
      queryClient.removeQueries({
        queryKey: ['listingTextContent', variables.rentalObjectCode],
      })
    },
  })
}
