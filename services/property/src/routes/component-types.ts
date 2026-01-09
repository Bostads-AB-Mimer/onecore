import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  componentTypesQueryParamsSchema,
  ComponentTypeSchema,
  CreateComponentTypeSchema,
  UpdateComponentTypeSchema,
} from '../types/component'
import {
  getComponentTypes,
  getComponentTypeById,
  createComponentType,
  updateComponentType,
  deleteComponentType,
} from '../adapters/component-adapter'

/**
 * @swagger
 * tags:
 *   - name: Component Types
 *     description: Operations for managing component types
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /component-types:
   *   get:
   *     summary: Get all component types
   *     description: Specific kinds of components within a category (e.g., Diskmaskin, Värmepump, Takbeläggning). Filter by categoryId to get types for a specific category.
   *     tags: [Component Types]
   *     parameters:
   *       - in: query
   *         name: categoryId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter types by category ID
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
   *         description: List of component types
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentType'
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
    '(.*)/component-types',
    parseRequest({ query: componentTypesQueryParamsSchema }),
    async (ctx) => {
      const { categoryId, page, limit } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentTypes(categoryId, page, limit)

        ctx.body = {
          content: ComponentTypeSchema.array().parse(result.types),
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
   * /component-types/{id}:
   *   get:
   *     summary: Get component type by ID
   *     description: Returns a single type with its category relationship.
   *     tags: [Component Types]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Component type details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentType'
   *       404:
   *         description: Component type not found
   */
  router.get('(.*)/component-types/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const type = await getComponentTypeById(id)

      if (!type) {
        ctx.status = 404
        ctx.body = { error: 'Component type not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentTypeSchema.parse(type),
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
   * /component-types:
   *   post:
   *     summary: Create a new component type
   *     description: Creates a new type within a category. Requires categoryId.
   *     tags: [Component Types]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentTypeRequest'
   *     responses:
   *       201:
   *         description: Component type created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentType'
   */
  router.post(
    '(.*)/component-types',
    parseRequest({ body: CreateComponentTypeSchema }),
    async (ctx) => {
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const type = await createComponentType(data)

        ctx.status = 201
        ctx.body = {
          content: ComponentTypeSchema.parse(type),
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
   * /component-types/{id}:
   *   put:
   *     summary: Update a component type
   *     description: Updates type name or category assignment.
   *     tags: [Component Types]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentTypeRequest'
   *     responses:
   *       200:
   *         description: Component type updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentType'
   */
  router.put(
    '(.*)/component-types/:id',
    parseRequest({
      body: UpdateComponentTypeSchema,
    }),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const type = await updateComponentType(id, data)

        ctx.body = {
          content: ComponentTypeSchema.parse(type),
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
   * /component-types/{id}:
   *   delete:
   *     summary: Delete a component type
   *     description: Removes a type. Will fail if type has associated subtypes.
   *     tags: [Component Types]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Component type deleted
   */
  router.delete('(.*)/component-types/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      await deleteComponentType(id)
      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })
}
