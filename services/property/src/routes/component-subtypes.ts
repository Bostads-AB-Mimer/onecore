import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  componentSubtypesQueryParamsSchema,
  ComponentSubtypeSchema,
  CreateComponentSubtypeSchema,
  UpdateComponentSubtypeSchema,
} from '../types/component'
import {
  getComponentSubtypes,
  getComponentSubtypeById,
  createComponentSubtype,
  updateComponentSubtype,
  deleteComponentSubtype,
} from '../adapters/component-adapter'

export const routes = (router: KoaRouter) => {
  // ==================== COMPONENT SUBTYPES ROUTES ====================

  /**
   * @swagger
   * /component-subtypes:
   *   get:
   *     summary: Get all component subtypes
   *     tags: [Component Subtypes]
   *     parameters:
   *       - in: query
   *         name: typeId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter subtypes by type ID
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
   *         description: List of component subtypes
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentSubtype'
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
    '(.*)/component-subtypes',
    parseRequest({ query: componentSubtypesQueryParamsSchema }),
    async (ctx) => {
      const { typeId, subtypeName, page, limit } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentSubtypes({ typeId, subtypeName }, page, limit)

        ctx.body = {
          content: ComponentSubtypeSchema.array().parse(result.subtypes),
          pagination: result.pagination,
          ...metadata,
        }
      } catch (err) {
        console.error('Error getting component subtypes:', err)
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /component-subtypes/{id}:
   *   get:
   *     summary: Get component subtype by ID
   *     tags: [Component Subtypes]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component subtype details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentSubtype'
   *       404:
   *         description: Component subtype not found
   */
  router.get('(.*)/component-subtypes/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const subtype = await getComponentSubtypeById(id)

      if (!subtype) {
        ctx.status = 404
        ctx.body = { error: 'Component subtype not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentSubtypeSchema.parse(subtype),
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
   * /component-subtypes:
   *   post:
   *     summary: Create a new component subtype
   *     tags: [Component Subtypes]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentSubtypeRequest'
   *     responses:
   *       201:
   *         description: Component subtype created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentSubtype'
   */
  router.post(
    '(.*)/component-subtypes',
    parseRequest({ body: CreateComponentSubtypeSchema }),
    async (ctx) => {
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const subtype = await createComponentSubtype(data)

        ctx.status = 201
        ctx.body = {
          content: ComponentSubtypeSchema.parse(subtype),
          ...metadata,
        }
      } catch (err) {
        console.error('Error creating component subtype:', err)
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { error: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /component-subtypes/{id}:
   *   put:
   *     summary: Update a component subtype
   *     tags: [Component Subtypes]
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
   *             $ref: '#/components/schemas/UpdateComponentSubtypeRequest'
   *     responses:
   *       200:
   *         description: Component subtype updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentSubtype'
   */
  router.put(
    '(.*)/component-subtypes/:id',
    parseRequest({
      body: UpdateComponentSubtypeSchema,
    }),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const subtype = await updateComponentSubtype(id, data)

        ctx.body = {
          content: ComponentSubtypeSchema.parse(subtype),
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
   * /component-subtypes/{id}:
   *   delete:
   *     summary: Delete a component subtype
   *     tags: [Component Subtypes]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component subtype deleted
   */
  router.delete('(.*)/component-subtypes/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      await deleteComponentSubtype(id)
      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })
}
