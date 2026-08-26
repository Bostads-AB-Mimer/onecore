import axios from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateOfferErrorCodes } from '@onecore/types'

import { RequestError } from '../../../types'
import { mapCreateOfferErrors } from './createOfferErrorMappings'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

type Params = { listingId: number }

export const useCreateOffer = () => {
  const queryClient = useQueryClient()
  return useMutation<unknown, RequestError<CreateOfferErrorCodes>, Params>({
    mutationFn: (params: Params) =>
      axios
        .post<unknown>(
          `${backendUrl}/listings/${params.listingId}/offers`,
          params,
          {
            headers: {
              Accept: 'application/json',
              'Access-Control-Allow-Credentials': true,
            },
            withCredentials: true,
          }
        )
        .catch((error) => {
          return Promise.reject(mapCreateOfferErrors(error))
        }),
    onSuccess: (_, params) =>
      queryClient.invalidateQueries({
        queryKey: ['parkingSpaceListing', params.listingId],
      }),
  })
}
