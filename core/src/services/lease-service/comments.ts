import KoaRouter from '@koa/router'
import { leasing } from 'onecore-types'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import { generateRouteMetadata } from 'onecore-utilities'
import z from 'zod'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/comments/:targetType/thread/:targetId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const { targetType, targetId } = ctx.params

    const result = await leasingAdapter.getCommentThread({
      targetType,
      targetId: Number(targetId),
    })

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: 'Unknown error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  type AddCommentRequest = z.infer<
    typeof leasing.v1.AddCommentRequestParamsSchema
  >

  router.post('(.*)/comments/:targetType/thread/:targetId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const { targetType, targetId } = ctx.params
    const comment = <AddCommentRequest>ctx.request.body

    const result = await leasingAdapter.addComment(
      { targetType, targetId: Number(targetId) },
      comment
    )

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: 'Unknown error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.delete(
    '(.*)/comments/:targetType/thread/:targetId/:commentId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const { targetType, targetId, commentId } = ctx.params
      const threadId = { targetType, targetId: Number(targetId) }

      const result = await leasingAdapter.removeComment(
        threadId,
        Number(commentId)
      )

      if (!result.ok) {
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: null, ...metadata }
    }
  )
}
