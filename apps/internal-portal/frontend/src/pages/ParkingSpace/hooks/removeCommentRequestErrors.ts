import { AxiosError } from 'axios'

import { RequestError } from '../../../types'

export declare enum RemoveCommentRequestErrorCodes {
  AccessDenied = 'access-denied',
  Unknown = 'unknown',
}

export function mapRemoveCommentErrors(
  e: AxiosError<{
    error?: RemoveCommentRequestErrorCodes
    errorMessage: string
  }>
): RequestError<RemoveCommentRequestErrorCodes> {
  switch (e.response?.data?.error) {
    case RemoveCommentRequestErrorCodes.AccessDenied:
      return {
        status: e.response.status,
        errorHeading: 'Ej tillåtet',
        errorCode: RemoveCommentRequestErrorCodes.AccessDenied,
        errorMessage: 'Du kan endast ta bort dina egna kommentarer.',
      }
    case RemoveCommentRequestErrorCodes.Unknown:
    default:
      return {
        status: 500,
        errorHeading: 'Något gick fel...',
        errorCode: RemoveCommentRequestErrorCodes.Unknown,
        errorMessage: 'Försök igen eller kontakta support',
      }
  }
}
