import axios, { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

type Params = { listingId: number }

export const useUnpublishParkingSpaceListing = () => {
  const queryClient = useQueryClient()
  return useMutation<unknown, AxiosError, Params>({
    mutationFn: (params: Params) =>
      axios.put<unknown>(
        `${backendUrl}/listings/${params.listingId}/unpublish`,
        {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        }
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['parkingSpaceListings'],
      }),
  })
}
