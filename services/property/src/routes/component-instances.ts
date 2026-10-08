import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { property } from '@onecore/types'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  componentsQueryParamsSchema,
  ComponentSchema,
  CreateComponentSchema,
  UpdateComponentSchema,
} from '../types/component'
import {
  type ComponentModelProblem,
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  updateComponentInspectionState,
  getComponentsByRoomId,
  findComponentModelProblem,
} from '../adapters/component-adapter'
import { prismaErrorCode } from '../utils/prisma-errors'

const modelProblemResponse: Record<ComponentModelProblem, string> = {
  subtype_not_found: 'Invalid subtypeId: component subtype does not exist',
  model_not_found: 'Invalid modelId: component model does not exist',
  model_subtype_mismatch:
    'The model belongs to another subtype than the component',
  surface_has_model: 'A component in a SURFACE category cannot have a model',
}

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
   *     description: Physical units with serial numbers and status. Filter by modelId, subtypeId, status (ACTIVE/INACTIVE/MAINTENANCE/DECOMMISSIONED), or serialNumber.
   *     tags: [Component Instances]
   *     parameters:
   *       - in: query
   *         name: modelId
   *         schema:
   *           type: string
   *       - in: query
   *         name: subtypeId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter by subtype
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
   *                     $ref: '#/components/schemas/Component'
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
    parseRequest({ query: componentsQueryParamsSchema }),
    async (ctx) => {
      const { modelId, subtypeId, status, serialNumber, page, limit } =
        ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx, [
        'modelId',
        'subtypeId',
        'status',
        'serialNumber',
        'page',
        'limit',
      ])

      try {
        const result = await getComponents(
          { modelId, subtypeId, status, serialNumber },
          page,
          limit
        )

        ctx.body = {
          content: ComponentSchema.array().parse(result.components),
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
   *     description: Returns full component details including purchase info, warranty dates, and current status.
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
   *                   $ref: '#/components/schemas/Component'
   *       404:
   *         description: Component not found
   */
  router.get('(.*)/components/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const idResult = z.string().uuid().safeParse(ctx.params.id)
    if (!idResult.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid UUID format', ...metadata }
      return
    }
    const id = idResult.data

    try {
      const component = await getComponentById(id)

      if (!component) {
        ctx.status = 404
        ctx.body = { error: 'Component not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentSchema.parse(component),
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
   *     description: Registers a new physical unit. Requires subtypeId. modelId is optional and must belong to the same subtype; components in a SURFACE category take no model.
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
   *                   $ref: '#/components/schemas/Component'
   *       400:
   *         description: Unknown subtypeId or modelId, model under another subtype, or a model on a SURFACE component
   */
  router.post(
    '(.*)/components',
    parseRequest({ body: CreateComponentSchema }),
    async (ctx) => {
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const problem = await findComponentModelProblem({
          subtypeId: data.subtypeId,
          modelId: data.modelId,
        })
        if (problem) {
          ctx.status = 400
          ctx.body = { error: modelProblemResponse[problem], ...metadata }
          return
        }

        const component = await createComponent(data)

        ctx.status = 201
        ctx.body = {
          content: ComponentSchema.parse(component),
          ...metadata,
        }
      } catch (err) {
        if (prismaErrorCode(err) === 'P2003') {
          ctx.status = 400
          ctx.body = {
            error:
              'Invalid subtypeId or modelId: referenced row does not exist',
            ...metadata,
          }
          return
        }
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.status = 500
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components/{id}:
   *   put:
   *     summary: Update a component instance
   *     description: Updates component status, warranty dates, or other attributes.
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
   *                   $ref: '#/components/schemas/Component'
   *       400:
   *         description: Unknown subtypeId or modelId, model under another subtype, or a model on a SURFACE component
   *       404:
   *         description: Component not found
   */
  router.put(
    '(.*)/components/:id',
    parseRequest({
      body: UpdateComponentSchema,
    }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const idResult = z.string().uuid().safeParse(ctx.params.id)
      if (!idResult.success) {
        ctx.status = 400
        ctx.body = { error: 'Invalid UUID format', ...metadata }
        return
      }
      const id = idResult.data
      const data = ctx.request.parsedBody

      try {
        const existing = await getComponentById(id)
        if (!existing) {
          ctx.status = 404
          ctx.body = { error: 'Component not found', ...metadata }
          return
        }

        if (data.subtypeId !== undefined || data.modelId !== undefined) {
          const problem = await findComponentModelProblem({
            subtypeId: data.subtypeId ?? existing.subtypeId,
            modelId:
              data.modelId === undefined ? existing.modelId : data.modelId,
          })
          if (problem) {
            ctx.status = 400
            ctx.body = { error: modelProblemResponse[problem], ...metadata }
            return
          }
        }

        const component = await updateComponent(id, data)

        ctx.body = {
          content: ComponentSchema.parse(component),
          ...metadata,
        }
      } catch (err) {
        if (prismaErrorCode(err) === 'P2003') {
          ctx.status = 400
          ctx.body = {
            error:
              'Invalid subtypeId or modelId: referenced row does not exist',
            ...metadata,
          }
          return
        }
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components/{id}/inspection-state:
   *   put:
   *     summary: Update component inspection state
   *     description: Updates component condition and last inspection date. Only accepts the three condition values written back from inspections.
   *     tags: [Component Instances]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [condition, lastInspectionDate]
   *             properties:
   *               condition:
   *                 type: string
   *                 enum: [GOOD, FAIR, DAMAGED]
   *               lastInspectionDate:
   *                 type: string
   *                 format: date-time
   *     responses:
   *       200:
   *         description: Component inspection state updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Component'
   *       400:
   *         description: Invalid request
   *       404:
   *         description: Component not found
   *       500:
   *         description: Internal server error
   */
  router.put(
    '(.*)/components/:id/inspection-state',
    parseRequest({ body: property.UpdateComponentInspectionStateSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const idResult = z.string().uuid().safeParse(ctx.params.id)
      if (!idResult.success) {
        ctx.status = 400
        ctx.body = { error: 'Invalid UUID format', ...metadata }
        return
      }
      const id = idResult.data
      const body = ctx.request
        .parsedBody as property.UpdateComponentInspectionState

      try {
        const existing = await getComponentById(id)
        if (!existing) {
          ctx.status = 404
          ctx.body = { error: 'Component not found', ...metadata }
          return
        }

        const component = await updateComponentInspectionState(id, body)
        ctx.body = {
          content: ComponentSchema.parse(component),
          ...metadata,
        }
      } catch (err) {
        logger.error({ err }, 'componentRoutes.updateInspectionState')
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
   *     description: Removes a component record. Automatically deletes associated installation records.
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
    const metadata = generateRouteMetadata(ctx)

    const idResult = z.string().uuid().safeParse(ctx.params.id)
    if (!idResult.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid UUID format', ...metadata }
      return
    }
    const id = idResult.data

    try {
      const existing = await getComponentById(id)
      if (!existing) {
        ctx.status = 404
        ctx.body = { error: 'Component not found', ...metadata }
        return
      }

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
   *       Returns all components currently installed in a specific space via their installation records.
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
   *                     $ref: '#/components/schemas/Component'
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
        content: ComponentSchema.array().parse(components),
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
