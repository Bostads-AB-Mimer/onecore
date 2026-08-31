import {
  Comment,
  CommentThread,
  CommentThreadId,
  leasing,
} from '@onecore/types'
import { AxiosError } from 'axios'
import { loggedAxios as axios } from '@onecore/utilities'
import z from 'zod'
import { AdapterResult } from '../types'

import config from '../../common/config'
const tenantsLeasesServiceUrl = config.tenantsLeasesService.url

const getCommentThread = async (
  threadId: CommentThreadId
): Promise<AdapterResult<CommentThread, 'unknown'>> => {
  const threadResponse = await axios(
    `${tenantsLeasesServiceUrl}/comments/${threadId.targetType}/thread/${threadId.targetId}`
  )

  if (threadResponse.status === 200) {
    return { ok: true, data: threadResponse.data.content }
  }

  return { ok: false, err: 'unknown' }
}

type AddCommentRequest = z.infer<
  typeof leasing.v1.AddCommentRequestParamsSchema
>

const addComment = async (
  threadId: CommentThreadId,
  comment: AddCommentRequest
): Promise<AdapterResult<Comment, 'unknown'>> => {
  const response = await axios.post<{ content: Comment }>(
    `${tenantsLeasesServiceUrl}/comments/${threadId.targetType}/thread/${threadId.targetId}`,
    comment
  )

  if (response.status === 200 || response.status == 201) {
    return {
      ok: true,
      data: response.data.content,
      statusCode: response.status,
    }
  }

  return { ok: false, err: 'unknown', statusCode: response.status }
}

const removeComment = async (
  threadId: CommentThreadId,
  commentId: number
): Promise<AdapterResult<void, 'unknown'>> => {
  const response = await axios.delete<void>(
    `${tenantsLeasesServiceUrl}/comments/${threadId.targetType}/thread/${threadId.targetId}/${commentId}`
  )

  if (response.status === 200 || response.status == 204) {
    return {
      ok: true,
      data: undefined,
      statusCode: response.status,
    }
  }

  return { ok: false, err: 'unknown', statusCode: response.status }
}

type UpdateCommentRequest = z.infer<
  typeof leasing.v1.UpdateCommentRequestParamsSchema
>

const updateComment = async (
  threadId: CommentThreadId,
  commentId: number,
  comment: UpdateCommentRequest
): Promise<AdapterResult<Comment, 'not-found' | 'unknown'>> => {
  try {
    const response = await axios.put<{ content: Comment }>(
      `${tenantsLeasesServiceUrl}/comments/${threadId.targetType}/thread/${threadId.targetId}/${commentId}`,
      comment
    )

    return {
      ok: true,
      data: response.data.content,
      statusCode: response.status,
    }
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 404) {
      return { ok: false, err: 'not-found', statusCode: 404 }
    }

    return { ok: false, err: 'unknown', statusCode: 500 }
  }
}

export { addComment, getCommentThread, removeComment, updateComment }
