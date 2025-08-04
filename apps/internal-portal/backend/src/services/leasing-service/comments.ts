import KoaRouter from '@koa/router'
import * as coreAdapter from './adapters/core-adapter'
import { generateRouteMetadata } from '@onecore/utilities'
import { Comment, leasing } from '@onecore/types'
import z from 'zod'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/comments/:targetType/thread/:targetId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { targetType, targetId } = ctx.params

    const result = await coreAdapter.getCommentThread({
      targetType,
      targetId: Number(targetId),
    })
    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
    } else {
      ctx.status = 200
      ctx.body = {
        content: result.data,
        ...metadata,
      }
    }
  })

  const AddCommentPayloadSchema = leasing.v1.AddCommentRequestParamsSchema.pick(
    {
      comment: true,
      type: true,
    }
  )

  router.post('(.*)/comments/:targetType/thread/:targetId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { targetType, targetId } = ctx.params

    const parseResult = AddCommentPayloadSchema.safeParse(ctx.request.body)

    if (!parseResult.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid request body',
        invalid: ctx.request.body,
        detail: parseResult.error,
        ...metadata,
      }
      return
    }

    const result = await coreAdapter.addComment(
      { targetType, targetId: Number(targetId) },
      {
        ...parseResult.data,
        authorName: ctx.session?.account.name,
        authorId: ctx.session?.account.username,
      }
    )

    if (!result.ok) {
      ctx.status = result.statusCode
      ctx.body = { error: result.err, ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.delete(
    '(.*)/comments/:targetType/thread/:targetId/:commentId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { targetType, targetId } = ctx.params
      const threadId = { targetType, targetId: Number(targetId) }
      const commentId = Number(ctx.params.commentId)

      const threadResult = await coreAdapter.getCommentThread(threadId)
      if (!threadResult.ok) {
        ctx.status = threadResult.statusCode || 500
        ctx.body = { error: threadResult.err, ...metadata }
        return
      }

      const comment = threadResult.data.comments.find(
        (c: Comment) => c.id === commentId
      )
      if (!comment) {
        ctx.status = 404
        ctx.body = { error: 'not-found', ...metadata }
        return
      } else if (comment.authorId !== ctx.session?.account.username) {
        ctx.status = 401
        ctx.body = { error: 'access-denied', ...metadata }
      }

      const result = await coreAdapter.removeComment(threadId, commentId)

      if (!result.ok) {
        ctx.status = result.statusCode
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: null, ...metadata }
    }
  )
}
