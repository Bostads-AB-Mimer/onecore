import KoaRouter from '@koa/router'
import { leasing } from '@onecore/types'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import { generateRouteMetadata } from '@onecore/utilities'
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

  /**
   * @swagger
   * /comments/{targetType}/thread/{targetId}/{commentId}:
   *   put:
   *     summary: Update a comment in a comment thread
   *     description: |
   *       Update the text and/or type of an existing comment in the comment
   *       thread identified by targetType/targetId and the comment id.
   *     tags: [Comment]
   *     parameters:
   *       - in: path
   *         name: targetType
   *         required: true
   *         schema:
   *           type: string
   *         description: The object type that the comment thread belongs to.
   *       - in: path
   *         name: targetId
   *         required: true
   *         schema:
   *           type: number
   *         description: The object id that the comment thread belongs to.
   *       - in: path
   *         name: commentId
   *         required: true
   *         schema:
   *           type: number
   *         description: The unique ID of the comment to update.
   *     requestBody:
   *       required: true
   *       content:
   *          application/json:
   *             schema:
   *               type: object
   *               required:
   *                 - type
   *                 - comment
   *               properties:
   *                 type:
   *                   type: string
   *                   enum: [COMMENT, WARNING, STOP]
   *                 comment:
   *                   type: string
   *     responses:
   *       200:
   *         description: The updated comment
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   description: The updated comment
   *       400:
   *         description: Invalid request body
   *       404:
   *         description: The comment was not found in the given thread
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.put(
    '(.*)/comments/:targetType/thread/:targetId/:commentId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const { targetType, targetId, commentId } = ctx.params
      const threadId = { targetType, targetId: Number(targetId) }

      const parseResult = leasing.v1.UpdateCommentRequestParamsSchema.safeParse(
        ctx.request.body
      )

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

      const result = await leasingAdapter.updateComment(
        threadId,
        Number(commentId),
        parseResult.data
      )

      if (!result.ok) {
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )
}
