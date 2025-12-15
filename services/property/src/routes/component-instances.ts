import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  componentsNewQueryParamsSchema,
  ComponentNewSchema,
  CreateComponentNewSchema,
  UpdateComponentNewSchema,
} from '../types/component'
import {
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  getComponentsByRoomId,
} from '../adapters/component-adapter'

/**
 * @swagger
 * tags:
 *   - name: Component Instances
 *     description: Operations for managing component instances
 */
export const routes = (router: KoaRouter) => {
  // ==================== COMPONENTS ROUTES ====================

  /**
   * @swagger
   * /components:
   *   get:
   *     summary: Get all component instances
   *     tags: [Component Instances]
   *     parameters:
   *       - in: query
   *         name: modelId
   *         schema:
   *           type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [ACTIVE, INACTIVE, MAINTENANCE, DECOMMISSIONED]
   *       - in: query
   *         name: serialNumber
   *         schema:
   *           type: string
   *         description: Search by serial number (case-insensitive partial match)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of component instances
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentInstance'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     total:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   */
  router.get(
    '(.*)/components',
    parseRequest({ query: componentsNewQueryParamsSchema }),
    async (ctx) => {
      const { modelId, status, serialNumber, page, limit } =
        ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponents(
          { modelId, status, serialNumber },
          page,
          limit
        )

        ctx.body = {
          content: ComponentNewSchema.array().parse(result.components),
          pagination: result.pagination,
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components/{id}:
   *   get:
   *     summary: Get component instance by ID
   *     tags: [Component Instances]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component instance details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstance'
   *       404:
   *         description: Component not found
   */
  router.get('(.*)/components/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const component = await getComponentById(id)

      if (!component) {
        ctx.status = 404
        ctx.body = { error: 'Component not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentNewSchema.parse(component),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /components:
   *   post:
   *     summary: Create a new component instance
   *     tags: [Component Instances]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentRequest'
   *     responses:
   *       201:
   *         description: Component instance created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstance'
   */
  router.post(
    '(.*)/components',
    parseRequest({ body: CreateComponentNewSchema }),
    async (ctx) => {
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const component = await createComponent(data)

        ctx.status = 201
        ctx.body = {
          content: ComponentNewSchema.parse(component),
          ...metadata,
        }
      } catch (err) {
        console.error('Error creating component:', err)
        console.error('Request data:', data)
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        const errorStack = err instanceof Error ? err.stack : undefined
        ctx.body = { error: errorMessage, stack: errorStack, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components/{id}:
   *   put:
   *     summary: Update a component instance
   *     tags: [Component Instances]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentRequest'
   *     responses:
   *       200:
   *         description: Component instance updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstance'
   */
  router.put(
    '(.*)/components/:id',
    parseRequest({
      body: UpdateComponentNewSchema,
    }),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const component = await updateComponent(id, data)

        ctx.body = {
          content: ComponentNewSchema.parse(component),
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components/{id}:
   *   delete:
   *     summary: Delete a component instance
   *     tags: [Component Instances]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component instance deleted
   */
  router.delete('(.*)/components/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      await deleteComponent(id)
      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  // ==================== COMPONENTS BY ROOM ====================

  /**
   * @swagger
   * /components/by-room/{roomId}:
   *   get:
   *     summary: Get components installed in a specific room
   *     description: |
   *       Retrieves all components currently installed in the specified room.
   *       Only returns components that are currently installed (no deinstallation date).
   *     tags: [Component Instances]
   *     parameters:
   *       - in: path
   *         name: roomId
   *         required: true
   *         schema:
   *           type: string
   *           maxLength: 15
   *         description: Room ID (variable length, max 15 characters, Xpand legacy format)
   *     responses:
   *       200:
   *         description: List of components in the room
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentInstance'
   *       400:
   *         description: Invalid room ID format
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/components/by-room/:roomId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Validate roomId is at most 15 characters
    const roomIdValidation = z.string().max(15).safeParse(ctx.params.roomId)
    if (!roomIdValidation.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Room ID must be at most 15 characters (Xpand format)',
        ...metadata,
      }
      return
    }

    const roomId = roomIdValidation.data

    try {
      const components = await getComponentsByRoomId(roomId)
      ctx.body = {
        content: ComponentNewSchema.array().parse(components),
        ...metadata,
      }
    } catch (err) {
      console.error('Error in getComponentsByRoomId:', err)
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      const errorStack = err instanceof Error ? err.stack : undefined
      ctx.body = {
        error: errorMessage,
        stack: errorStack,
        ...metadata,
      }
    }
  })
}
