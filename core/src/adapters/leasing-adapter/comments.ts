import { Comment, CommentThread, CommentThreadId, leasing } from 'onecore-types'
import { loggedAxios as axios } from 'onecore-utilities'
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

export { addComment, getCommentThread, removeComment }
