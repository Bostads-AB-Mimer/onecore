import { AxiosError } from 'axios'
import { CreateOfferErrorCodes } from '@onecore/types'

import { RequestError } from '../../../types'

export function mapCreateOfferErrors(
  e: AxiosError<{
    error?: CreateOfferErrorCodes
    errorMessage: string
  }>
): RequestError<CreateOfferErrorCodes> {
  const defaultError = {
    status: e.response?.status ?? 500,
    errorHeading: 'Något gick fel...',
    errorCode: CreateOfferErrorCodes.Unknown,
    errorMessage: 'Försök igen eller kontakta support',
  }
  if (!e.response?.data) {
    return defaultError
  }
  switch (e.response.data?.error) {
    case CreateOfferErrorCodes.NoApplicants:
      return {
        status: e.response.status,
        errorCode: CreateOfferErrorCodes.NoApplicants,
        errorHeading: 'Inget erbjudande skapades',
        errorMessage: 'Ingen berättigad sökande hittades för annonsen.',
      }
    default: {
      return defaultError
    }
  }
}
