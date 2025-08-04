import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { CommentThread, CommentThreadId } from 'onecore-types'

import apiClient from '../../../utils/api-client'

export const useCommentThread = (
  threadId: CommentThreadId
): UseQueryResult<CommentThread, AxiosError> =>
  useQuery<CommentThread, AxiosError>({
    queryKey: ['comment-section', threadId],
    enabled: Boolean(threadId),
    queryFn: async () => {
      return await apiClient
        .get(`/comments/${threadId.targetType}/thread/${threadId.targetId}`)
        .then((response) => response.data.content)
    },
    retry: (failureCount: number, error: AxiosError) =>
      error.response?.status === 401 || error.response?.status === 500
        ? false
        : failureCount < 3,
  })
