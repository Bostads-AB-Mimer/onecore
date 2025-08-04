import { useMutation } from '@tanstack/react-query'
import { CommentThreadId, Comment, CommentType } from '@onecore/types'

import apiClient from '../../../utils/api-client'
import { RequestError } from '../../../types'
import {
  AddCommentRequestErrorCodes,
  mapAddCommentErrors,
} from './addCommentRequestErrors'

export type AddCommentRequest = {
  threadId: CommentThreadId
  comment: { comment: string; type: CommentType }
}

export const useAddComment = () => {
  return useMutation<
    Comment,
    RequestError<AddCommentRequestErrorCodes>,
    AddCommentRequest
  >({
    mutationFn: (params) => {
      const { targetType, targetId } = params.threadId
      return apiClient
        .post<{ content: Comment }>(
          `/comments/${targetType}/thread/${targetId}`,
          params.comment
        )
        .then((res) => res.data.content)
        .catch((error) => {
          return Promise.reject(mapAddCommentErrors(error))
        })
    },
  })
}
