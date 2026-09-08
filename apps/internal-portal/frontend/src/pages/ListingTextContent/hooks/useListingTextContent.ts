import axios, { AxiosError } from 'axios'
import {
  QueryClient,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { leasing } from '@onecore/types'
import { z } from 'zod'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

type ListingTextContent = z.infer<typeof leasing.v1.ListingTextContentSchema>
type ListingTextContentLookup = z.infer<
  typeof leasing.v1.ListingTextContentLookupSchema
>
type CreateListingTextContentRequest = z.infer<
  typeof leasing.v1.CreateListingTextContentRequestSchema
>
type UpdateListingTextContentRequest = z.infer<
  typeof leasing.v1.UpdateListingTextContentRequestSchema
>

// Patch saved content into the cached lookup for its code so the editor never
// sees a stale `content: null` (or a missing entry) between a successful save
// and the refetch triggered by invalidation. Keeps the already resolved
// marketArea/areaContent.
const setCachedContent = (
  queryClient: QueryClient,
  content: ListingTextContent
) =>
  queryClient.setQueryData<ListingTextContentLookup>(
    ['listingTextContent', content.rentalObjectCode],
    (old) =>
      old
        ? { ...old, content }
        : { content, marketArea: null, areaContent: null }
  )

// GET - Fetch listing text content by rental object code, together with the
// market-area text of the property it belongs to (null for non-housing).
export const useListingTextContent = (rentalObjectCode?: string) =>
  useQuery<ListingTextContentLookup, AxiosError>({
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
        .then((res) => ({
          content: res.data.content,
          marketArea: res.data.marketArea,
          areaContent: res.data.areaContent,
        })),
    enabled: !!rentalObjectCode,
    retry: (failureCount: number, error: AxiosError) => {
      if (error.response?.status === 401) {
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
      setCachedContent(queryClient, data)
      queryClient.invalidateQueries({
        queryKey: ['listingTextContent'],
      })
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
      setCachedContent(queryClient, data)
      queryClient.invalidateQueries({
        queryKey: ['listingTextContent'],
      })
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
