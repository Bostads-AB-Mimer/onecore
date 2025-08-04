import { AxiosError } from 'axios'
import { ReplyToOfferErrorCodes } from 'onecore-types'

import { RequestError } from '../../../types'

export function mapReplyOfferErrors(
  e: AxiosError<{
    error?: ReplyToOfferErrorCodes
    errorMessage: string
  }>
): RequestError<ReplyToOfferErrorCodes> {
  const defaultError = {
    status: 500,
    errorHeading: 'Något gick fel...',
    errorCode: ReplyToOfferErrorCodes.Unknown,
    errorMessage: 'Försök igen eller kontakta support',
  }
  if (!e.response?.data) {
    return defaultError
  }
  switch (e.response.data?.error) {
    case ReplyToOfferErrorCodes.NoActiveOffer:
      return {
        status: e.response.status,
        errorCode: ReplyToOfferErrorCodes.NoActiveOffer,
        errorHeading: 'Ej godkänd',
        errorMessage: 'Erbjudande ej aktivt.',
      }
    case ReplyToOfferErrorCodes.NoOffer:
      return {
        status: e.response.status,
        errorCode: ReplyToOfferErrorCodes.NoOffer,
        errorHeading: 'Ej godkänd',
        errorMessage: 'Erbjudande hittades ej.',
      }
    case ReplyToOfferErrorCodes.NoListing:
      return {
        status: e.response.status,
        errorCode: ReplyToOfferErrorCodes.NoListing,
        errorHeading: 'Ej godkänd',
        errorMessage: 'Annons saknas.',
      }
    case ReplyToOfferErrorCodes.CreateLeaseFailure:
      return {
        status: e.response.status,
        errorCode: ReplyToOfferErrorCodes.CreateLeaseFailure,
        errorHeading: 'Ej godkänd',
        errorMessage: 'Kunde ej skapa kontrakt.',
      }
    case ReplyToOfferErrorCodes.CloseOfferFailure:
      return {
        status: e.response.status,
        errorCode: ReplyToOfferErrorCodes.CloseOfferFailure,
        errorHeading: 'Ej godkänd',
        errorMessage: 'Kunde ej stänga erbjudande.',
      }
    default: {
      return defaultError
    }
  }
}
