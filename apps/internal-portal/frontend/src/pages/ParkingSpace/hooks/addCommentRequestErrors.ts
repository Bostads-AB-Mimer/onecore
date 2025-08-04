import { AxiosError } from 'axios'

import { RequestError } from '../../../types'

export declare enum AddCommentRequestErrorCodes {
  EmptyComment = 'empty-comment',
  Unknown = 'unknown',
}

export function mapAddCommentErrors(
  e: AxiosError<{ error?: AddCommentRequestErrorCodes; errorMessage: string }>
): RequestError<AddCommentRequestErrorCodes> {
  switch (e.response?.data?.error) {
    case AddCommentRequestErrorCodes.EmptyComment:
      return {
        status: e.response.status,
        errorHeading: 'Tom kommentar',
        errorCode: AddCommentRequestErrorCodes.EmptyComment,
        errorMessage: 'Kan ej lämna tom kommentar.',
      }
    case AddCommentRequestErrorCodes.Unknown:
    default:
      return {
        status: 500,
        errorHeading: 'Något gick fel...',
        errorCode: AddCommentRequestErrorCodes.Unknown,
        errorMessage: 'Försök igen eller kontakta support',
      }
  }
}
