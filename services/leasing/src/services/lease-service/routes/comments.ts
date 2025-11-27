import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import commentAdapter from '../adapters/comment-adapter'
import { leasing } from '@onecore/types'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /comments/{targetType}/thread/{targetId}:
   *   get:
   *     summary: Get comment thread for an object
   *     description: |
   *       Fetch the entire comment thread for a specific object,
   *       identified by the logical threadId of targetType/targetId.
   *       All valid threadIds implicitly have a valid comment thread
   *       resource even if no comments exists, in which case an empty
   *       thread will be returned rather than 404 Not Found.
   *     tags: [Comment]
   *     parameters:
   *       - in: path
   *         name: targetType
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The object type that the comment thread belongs to.
   *       - in: path
   *         name: targetId
   *         required: true
   *         schema:
   *           type: number
   *         description: |
   *           The object id that the comment thread belongs to.
   *     responses:
   *       200:
   *         description: Comment thread object
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The comment thread
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/comments/:targetType/thread/:targetId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const threadId = {
      targetType: ctx.params.targetType,
      targetId: Number(ctx.params.targetId),
    }

    const thread = await commentAdapter.getCommentThreadById(threadId)
    if (thread == undefined) {
      ctx.status = 200
      ctx.body = { content: { id: threadId, comments: [] }, ...metadata }
      return
    }

    ctx.body = { content: thread, ...metadata }
  })

  /**
   * @swagger
   * /comments/{targetType}/thread/{targetId}:
   *   get:
   *     summary: Add a Comment to a CommentThread
   *     description: |
   *       Add a new comment to the comment thread for a specific object,
   *       identified by the logical threadId of targetType/targetId.
   *       All valid threadIds implicitly have a valid comment thread
   *       resource even if no comments exists, which means that adding
   *       a comment to a physically non-existing thread implicitly creates
   *       it.
   *     tags: [Comment]
   *     parameters:
   *       - in: path
   *         name: targetType
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The object type that the comment thread belongs to.
   *       - in: path
   *         name: targetId
   *         required: true
   *         schema:
   *           type: number
   *         description: |
   *           The object id that the comment thread belongs to.
   *     requestBody:
   *       required: true
   *       content:
   *          application/json:
   *             schema:
   *               type: object
   *     responses:
   *       201:
   *         description: The comment was successfully created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The created comment
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/comments/:targetType/thread/:targetId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const threadId = {
      targetType: ctx.params.targetType,
      targetId: Number(ctx.params.targetId),
    }
    const parseResult = leasing.v1.AddCommentRequestParamsSchema.safeParse(
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

    const result = await commentAdapter.addComment(threadId, parseResult.data)

    ctx.status = 201
    ctx.body = { content: result, ...metadata }
  })

  /**
   * @swagger
   * /comments/{targetType}/thread/{targetId}/{commentId}:
   *   get:
   *     summary: Add a Comment to a CommentThread
   *     description: |
   *       Delete a comment from a comment thread.
   *     tags: [Comment]
   *     parameters:
   *       - in: path
   *         name: targetType
   *         required: true
   *         schema:
   *           type: string
   *         description: |
   *           The object type that the comment thread belongs to.
   *       - in: path
   *         name: targetId
   *         required: true
   *         schema:
   *           type: number
   *         description: |
   *           The object id that the comment thread belongs to.
   *       - in: path
   *         name: commentId
   *         required: true
   *         schema:
   *           type: number
   *         description: |
   *           The unique ID of the comment to delete.
   *     responses:
   *       201:
   *         description: The comment was successfully created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   description: The created comment
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.delete(
    '(.*)/comments/:targetType/thread/:targetId/:commentId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const { targetType, targetId, commentId } = ctx.params
      const threadId = { targetType, targetId: Number(targetId) }

      try {
        await commentAdapter.removeComment(threadId, Number(commentId))

        ctx.status = 200
        ctx.body = { content: null, ...metadata }
      } catch {
        ctx.status = 500
        ctx.body = { error: 'unknown', ...metadata }
      }
    }
  )
}
