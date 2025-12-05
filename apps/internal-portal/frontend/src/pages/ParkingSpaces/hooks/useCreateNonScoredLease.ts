import axios, { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { RequestError } from '../../../types'

const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api'

export type CreateNonScoredLeaseParams = {
  parkingSpaceId: string
  contactCode: string
  listingId: number
  startDate: string
}

export enum CreateNonScoredLeaseErrorCodes {
  InternalCreditCheckFailed = 'internal-credit-check-failed',
  ExternalCreditCheckFailed = 'external-credit-check-failed',
  InvalidAddress = 'invalid-address',
  AlreadyHasLease = 'already-has-lease',
  Unknown = 'unknown',
}

export const useCreateNonScoredLease = (listingId: number) => {
  const queryClient = useQueryClient()
  return useMutation<
    unknown,
    RequestError<CreateNonScoredLeaseErrorCodes>,
    CreateNonScoredLeaseParams
  >({
    mutationFn: (params: CreateNonScoredLeaseParams) =>
      axios
        .post<unknown>(`${backendUrl}/listings/non-scored-lease`, params, {
          headers: {
            Accept: 'application/json',
            'Access-Control-Allow-Credentials': true,
          },
          withCredentials: true,
        })
        .catch((error) => {
          return Promise.reject(mapCreateNonScoredLeaseError(error))
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

  function mapCreateNonScoredLeaseError(
    e: AxiosError<{
      error?: CreateNonScoredLeaseErrorCodes
      errorMessage: string
    }>
  ): RequestError<CreateNonScoredLeaseErrorCodes> {
    const defaultError = {
      status: 500,
      errorHeading: 'Något gick fel...',
      errorCode: CreateNonScoredLeaseErrorCodes.Unknown,
      errorMessage: 'Försök igen eller kontakta support',
    }
    if (!e.response?.data) {
      return defaultError
    }
    switch (e.response.data?.error) {
      case CreateNonScoredLeaseErrorCodes.InternalCreditCheckFailed:
        return {
          status: 400,
          errorCode: CreateNonScoredLeaseErrorCodes.InternalCreditCheckFailed,
          errorHeading: 'Kreditprövning misslyckades',
          errorMessage:
            'Kunden uppfyller inte kraven för en intern kreditkontroll. Kunden har en eller flera inkassofakturor de senaste 6 månaderna.',
        }
      case CreateNonScoredLeaseErrorCodes.ExternalCreditCheckFailed:
        return {
          status: 400,
          errorCode: CreateNonScoredLeaseErrorCodes.ExternalCreditCheckFailed,
          errorHeading: 'Kreditprövning misslyckades',
          errorMessage: 'Kunden uppfyller inte kraven för kreditkontroll.',
        }
      case CreateNonScoredLeaseErrorCodes.InvalidAddress:
        return {
          status: 400,
          errorCode: CreateNonScoredLeaseErrorCodes.InvalidAddress,
          errorHeading: 'Ogiltig adress',
          errorMessage:
            'Kunden saknar gatuadress, postnummer eller stad. Kontakta kunden för att uppdatera adressuppgifterna.',
        }
      case CreateNonScoredLeaseErrorCodes.AlreadyHasLease:
        return {
          status: 400,
          errorCode: CreateNonScoredLeaseErrorCodes.AlreadyHasLease,
          errorHeading: 'Kontrakt finns redan',
          errorMessage: 'Kunden har redan ett kontrakt för denna bilplats.',
        }
      default: {
        return defaultError
      }
    }
  }
}
