import axios, { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreateNoteOfInterestErrorCodes } from 'onecore-types'

import { RequestError } from '../../../types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export type CreateNoteOfInterestRequestParams = {
  parkingSpaceId: string
  applicationType?: string
  contactCode: string
}

export const useCreateNoteOfInterest = (listingId: number) => {
  const queryClient = useQueryClient()
  return useMutation<
    unknown,
    RequestError<CreateNoteOfInterestErrorCodes>,
    CreateNoteOfInterestRequestParams
  >({
    mutationFn: (params: CreateNoteOfInterestRequestParams) =>
      axios
        .post<unknown>(`${backendUrl}/listings/applicant`, params, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .catch((error) => {
          return Promise.reject(mapCreateNoteOfInterestError(error))
        }),
    onSuccess: () =>
      Promise.all([
        queryClient.refetchQueries({
          queryKey: ['parkingSpaceListing', listingId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['parkingSpaceListings'],
        }),
      ]),
  })

  function mapCreateNoteOfInterestError(
    e: AxiosError<{
      error?: CreateNoteOfInterestErrorCodes
      errorMessage: string
    }>
  ): RequestError<CreateNoteOfInterestErrorCodes> {
    const defaultError = {
      status: 500,
      errorHeading: 'Något gick fel...',
      errorCode: CreateNoteOfInterestErrorCodes.Unknown,
      errorMessage: 'Försök igen eller kontakta support',
    }
    if (!e.response?.data) {
      return defaultError
    }
    switch (e.response.data?.error) {
      case CreateNoteOfInterestErrorCodes.InternalCreditCheckFailed:
        return {
          status: 400,
          errorCode: CreateNoteOfInterestErrorCodes.InternalCreditCheckFailed,
          errorHeading: 'Ej godkänd',
          errorMessage:
            'Kunden uppfyller inte kraven för en intern kreditkontroll. Kunden har en eller flera inkassofakturor de senaste 6 månaderna.',
        }
      default: {
        return defaultError
      }
    }
  }
}
