import axios from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ReplyToOfferErrorCodes } from 'onecore-types'

import { RequestError } from '../../../types'
import { mapReplyOfferErrors } from './replyToOfferErrorMappings'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

type Params = { offerId: number; listingId: number }

export const useAcceptOffer = () => {
  const queryClient = useQueryClient()
  return useMutation<unknown, RequestError<ReplyToOfferErrorCodes>, Params>({
    mutationFn: (params: Params) =>
      axios
        .post<unknown>(`${backendUrl}/offers/${params.offerId}/accept`, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .catch((error) => {
          return Promise.reject(mapReplyOfferErrors(error))
        }),
    onSuccess: (_, params) =>
      queryClient.invalidateQueries({
        queryKey: ['parkingSpaceListing', params.listingId],
      }),
  })
}
