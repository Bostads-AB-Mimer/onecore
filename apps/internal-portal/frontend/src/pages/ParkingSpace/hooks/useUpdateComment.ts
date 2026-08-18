import { useMutation } from '@tanstack/react-query'
import { CommentThreadId, Comment, CommentType } from '@onecore/types'

import apiClient from '../../../utils/api-client'
import { RequestError } from '../../../types'
import {
  UpdateCommentRequestErrorCodes,
  mapUpdateCommentErrors,
} from './updateCommentRequestErrors'

export type UpdateCommentRequest = {
  threadId: CommentThreadId
  commentId: number
  comment: { comment: string; type: CommentType }
}

export const useUpdateComment = () => {
  return useMutation<
    Comment,
    RequestError<UpdateCommentRequestErrorCodes>,
    UpdateCommentRequest
  >({
    mutationFn: (params) => {
      const { targetType, targetId } = params.threadId
      return apiClient
        .put<{ content: Comment }>(
          `/comments/${targetType}/thread/${targetId}/${params.commentId}`,
          params.comment
        )
        .then((res) => res.data.content)
        .catch((error) => {
          return Promise.reject(mapUpdateCommentErrors(error))
        })
    },
  })
}
