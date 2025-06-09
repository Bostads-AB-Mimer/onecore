import KoaRouter from '@koa/router'
import * as coreAdapter from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/comments/:targetType/thread/:targetId', async (ctx) => {
    const threadId: CommentThread = ctx.params

    const result = await coreAdapter.getCommentThread(ctx.params)
  })
}
