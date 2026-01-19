import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  componentInstallationsQueryParamsSchema,
  ComponentInstallationSchema,
  CreateComponentInstallationSchema,
  UpdateComponentInstallationSchema,
} from '../types/component'
import {
  getComponentInstallations,
  getComponentInstallationById,
  createComponentInstallation,
  updateComponentInstallation,
  deleteComponentInstallation,
} from '../adapters/component-adapter'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /component-installations:
   *   get:
   *     summary: Get all component installations
   *     description: Placement records linking components to property locations (spaceId). A component can be moved between locations over time. Filter by componentId, spaceId, or buildingPartId.
   *     tags: [Component Installations]
   *     parameters:
   *       - in: query
   *         name: componentId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: spaceId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: buildingPartId
   *         schema:
   *           type: string
   *           format: uuid
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
   *         description: List of component installations
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentInstallation'
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
    '(.*)/component-installations',
    parseRequest({ query: componentInstallationsQueryParamsSchema }),
    async (ctx) => {
      const { componentId, spaceId, page, limit } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentInstallations(
          { componentId, spaceId },
          page,
          limit
        )

        ctx.body = {
          content: ComponentInstallationSchema.array().parse(
            result.installations
          ),
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
   * /component-installations/{id}:
   *   get:
   *     summary: Get component installation by ID
   *     description: Returns installation record with dates, location, order number, and cost.
   *     tags: [Component Installations]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component installation details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstallation'
   *       404:
   *         description: Component installation not found
   */
  router.get('(.*)/component-installations/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const idResult = z.string().uuid().safeParse(ctx.params.id)
    if (!idResult.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid UUID format', ...metadata }
      return
    }
    const id = idResult.data

    try {
      const installation = await getComponentInstallationById(id)

      if (!installation) {
        ctx.status = 404
        ctx.body = {
          error: 'Component installation not found',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: ComponentInstallationSchema.parse(installation),
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
   * /component-installations:
   *   post:
   *     summary: Create a new component installation
   *     description: Records a component being installed at a location. Requires componentId and spaceId.
   *     tags: [Component Installations]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentInstallationRequest'
   *     responses:
   *       201:
   *         description: Component installation created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstallation'
   */
  router.post(
    '(.*)/component-installations',
    parseRequest({ body: CreateComponentInstallationSchema }),
    async (ctx) => {
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const installation = await createComponentInstallation(data)

        ctx.status = 201
        ctx.body = {
          content: ComponentInstallationSchema.parse(installation),
          ...metadata,
        }
      } catch (err) {
        console.error('Error creating component installation:', err)
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
   * /component-installations/{id}:
   *   put:
   *     summary: Update a component installation
   *     description: Updates installation details or records deinstallation date.
   *     tags: [Component Installations]
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
   *             $ref: '#/components/schemas/UpdateComponentInstallationRequest'
   *     responses:
   *       200:
   *         description: Component installation updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentInstallation'
   */
  router.put(
    '(.*)/component-installations/:id',
    parseRequest({
      body: UpdateComponentInstallationSchema,
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
        const existing = await getComponentInstallationById(id)
        if (!existing) {
          ctx.status = 404
          ctx.body = { error: 'Component installation not found', ...metadata }
          return
        }

        const installation = await updateComponentInstallation(id, data)

        ctx.body = {
          content: ComponentInstallationSchema.parse(installation),
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
   * /component-installations/{id}:
   *   delete:
   *     summary: Delete a component installation
   *     description: Removes an installation record.
   *     tags: [Component Installations]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component installation deleted
   */
  router.delete('(.*)/component-installations/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const idResult = z.string().uuid().safeParse(ctx.params.id)
    if (!idResult.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid UUID format', ...metadata }
      return
    }
    const id = idResult.data

    try {
      const existing = await getComponentInstallationById(id)
      if (!existing) {
        ctx.status = 404
        ctx.body = { error: 'Component installation not found', ...metadata }
        return
      }

      await deleteComponentInstallation(id)
      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })
}
