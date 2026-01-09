import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  componentModelsQueryParamsSchema,
  ComponentModelSchema,
  CreateComponentModelSchema,
  UpdateComponentModelSchema,
} from '../types/component'
import {
  getComponentModels,
  getComponentModelById,
  findModelByExactName,
  createComponentModel,
  updateComponentModel,
  deleteComponentModel,
} from '../adapters/component-adapter'

export const routes = (router: KoaRouter) => {
  // ==================== COMPONENT MODELS ROUTES ====================

  /**
   * @swagger
   * /component-models:
   *   get:
   *     summary: Get all component models
   *     description: Specific manufacturer products with pricing, warranty, specifications, and dimensions. Filter by subtypeId, manufacturer, or modelName.
   *     tags: [Component Models]
   *     parameters:
   *       - in: query
   *         name: componentTypeId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter models by component type ID
   *       - in: query
   *         name: subtypeId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter models by subtype ID
   *       - in: query
   *         name: manufacturer
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter models by manufacturer name
   *       - in: query
   *         name: modelName
   *         required: false
   *         schema:
   *           type: string
   *         description: Search by model name or manufacturer (case-insensitive)
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
   *         description: List of component models
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentModel'
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
    '(.*)/component-models',
    parseRequest({ query: componentModelsQueryParamsSchema }),
    async (ctx) => {
      const {
        componentTypeId,
        subtypeId,
        manufacturer,
        modelName,
        page,
        limit,
      } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentModels(
          { componentTypeId, subtypeId, manufacturer, modelName },
          page,
          limit
        )

        ctx.body = {
          content: ComponentModelSchema.array().parse(result.models),
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
   * /component-models/by-name/{modelName}:
   *   get:
   *     summary: Find component model by exact name
   *     tags: [Component Models]
   *     description: Finds a component model by exact model name match. Used by the add-component process to check if a model already exists.
   *     parameters:
   *       - in: path
   *         name: modelName
   *         required: true
   *         schema:
   *           type: string
   *         description: The exact model name to search for
   *     responses:
   *       200:
   *         description: Component model found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModel'
   *       404:
   *         description: Component model not found
   */
  router.get('(.*)/component-models/by-name/:modelName', async (ctx) => {
    const modelName = z.string().min(1).parse(ctx.params.modelName)
    const metadata = generateRouteMetadata(ctx)

    try {
      const model = await findModelByExactName(modelName)

      if (!model) {
        ctx.status = 404
        ctx.body = { error: 'Component model not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentModelSchema.parse(model),
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
   * /component-models/{id}:
   *   get:
   *     summary: Get component model by ID
   *     description: Returns full model details including specs and current pricing.
   *     tags: [Component Models]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component model details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModel'
   *       404:
   *         description: Component model not found
   */
  router.get('(.*)/component-models/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const model = await getComponentModelById(id)

      if (!model) {
        ctx.status = 404
        ctx.body = { error: 'Component model not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentModelSchema.parse(model),
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
   * /component-models:
   *   post:
   *     summary: Create a new component model
   *     description: Creates a manufacturer product entry. Requires subtypeId.
   *     tags: [Component Models]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentModelRequest'
   *     responses:
   *       201:
   *         description: Component model created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModel'
   */
  router.post(
    '(.*)/component-models',
    parseRequest({ body: CreateComponentModelSchema }),
    async (ctx) => {
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const model = await createComponentModel(data)

        ctx.status = 201
        ctx.body = {
          content: ComponentModelSchema.parse(model),
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
   * /component-models/{id}:
   *   put:
   *     summary: Update a component model
   *     description: Updates model pricing, specs, or warranty info.
   *     tags: [Component Models]
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
   *             $ref: '#/components/schemas/UpdateComponentModelRequest'
   *     responses:
   *       200:
   *         description: Component model updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModel'
   */
  router.put(
    '(.*)/component-models/:id',
    parseRequest({
      body: UpdateComponentModelSchema,
    }),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const model = await updateComponentModel(id, data)

        ctx.body = {
          content: ComponentModelSchema.parse(model),
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
   * /component-models/{id}:
   *   delete:
   *     summary: Delete a component model
   *     description: Removes a model. Will fail if model has associated components.
   *     tags: [Component Models]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component model deleted
   */
  router.delete('(.*)/component-models/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      await deleteComponentModel(id)
      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })
}
