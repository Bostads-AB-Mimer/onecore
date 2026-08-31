import { AxiosError } from 'axios'

import { RequestError } from '../../../types'

export enum UpdateCommentRequestErrorCodes {
  AccessDenied = 'access-denied',
  Unknown = 'unknown',
}

export function mapUpdateCommentErrors(
  e: AxiosError<{
    error?: UpdateCommentRequestErrorCodes
    errorMessage: string
  }>
): RequestError<UpdateCommentRequestErrorCodes> {
  switch (e.response?.data?.error) {
    case UpdateCommentRequestErrorCodes.AccessDenied:
      return {
        status: e.response.status,
        errorHeading: 'Ej tillåtet',
        errorCode: UpdateCommentRequestErrorCodes.AccessDenied,
        errorMessage: 'Du kan endast redigera dina egna kommentarer.',
      }
    case UpdateCommentRequestErrorCodes.Unknown:
    default:
      return {
        status: 500,
        errorHeading: 'Något gick fel...',
        errorCode: UpdateCommentRequestErrorCodes.Unknown,
        errorMessage: 'Försök igen eller kontakta support',
      }
  }
}
