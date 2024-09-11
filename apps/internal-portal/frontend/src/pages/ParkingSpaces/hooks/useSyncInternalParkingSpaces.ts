import axios, { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { InternalParkingSpaceSyncSuccessResponse } from 'onecore-types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export const useSyncInternalParkingSpaces = () => {
  const queryClient = useQueryClient()
  return useMutation<InternalParkingSpaceSyncSuccessResponse, AxiosError>({
    mutationFn: () =>
      axios
        .post<{ content: InternalParkingSpaceSyncSuccessResponse }>(
          `${backendUrl}/listings/sync-internal-from-xpand`,
          null,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .then((res) => res.data.content),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['parkingSpaceListings'],
      }),
  })
}
