import { useMutation } from '@tanstack/react-query'
import { CommentThreadId } from 'onecore-types'

import apiClient from '../../../utils/api-client'
import {
  RemoveCommentRequestErrorCodes,
  mapRemoveCommentErrors,
} from './removeCommentRequestErrors'
import { RequestError } from '../../../types'

export const useRemoveComment = () => {
  return useMutation<
    unknown,
    RequestError<RemoveCommentRequestErrorCodes>,
    { threadId: CommentThreadId; commentId: number }
  >({
    mutationFn: async (params) => {
      const { targetType, targetId } = params.threadId
      return apiClient
        .delete<unknown>(
          `/comments/${targetType}/thread/${targetId}/${params.commentId}`
        )
        .catch((error) => {
          return Promise.reject(mapRemoveCommentErrors(error))
        })
    },
  })
}
