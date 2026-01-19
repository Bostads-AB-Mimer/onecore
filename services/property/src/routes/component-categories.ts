import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
  componentCategoriesQueryParamsSchema,
  ComponentCategorySchema,
  CreateComponentCategorySchema,
  UpdateComponentCategorySchema,
} from '../types/component'
import {
  getComponentCategories,
  getComponentCategoryById,
  createComponentCategory,
  updateComponentCategory,
  deleteComponentCategory,
} from '../adapters/component-adapter'

/**
 * @swagger
 * tags:
 *   - name: Component Categories
 *     description: Operations for managing component categories
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /component-categories:
   *   get:
   *     summary: Get all component categories
   *     description: Top-level groupings for building components (e.g., Ventilation, VVS, Vitvaror, Tak). Use categoryId to filter component types.
   *     tags: [Component Categories]
   *     parameters:
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
   *         description: List of component categories
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ComponentCategory'
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
    '(.*)/component-categories',
    parseRequest({ query: componentCategoriesQueryParamsSchema }),
    async (ctx) => {
      const { page, limit } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentCategories(page, limit)

        ctx.body = {
          content: ComponentCategorySchema.array().parse(result.categories),
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
   * /component-categories/{id}:
   *   get:
   *     summary: Get component category by ID
   *     description: Returns a single category with its name and metadata.
   *     tags: [Component Categories]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Component category details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentCategory'
   *       404:
   *         description: Component category not found
   */
  router.get('(.*)/component-categories/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const idResult = z.string().uuid().safeParse(ctx.params.id)
    if (!idResult.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid UUID format', ...metadata }
      return
    }
    const id = idResult.data

    try {
      const category = await getComponentCategoryById(id)

      if (!category) {
        ctx.status = 404
        ctx.body = { error: 'Component category not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentCategorySchema.parse(category),
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
   * /component-categories:
   *   post:
   *     summary: Create a new component category
   *     description: Creates a new top-level category for organizing component types.
   *     tags: [Component Categories]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentCategoryRequest'
   *     responses:
   *       201:
   *         description: Component category created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentCategory'
   */
  router.post(
    '(.*)/component-categories',
    parseRequest({ body: CreateComponentCategorySchema }),
    async (ctx) => {
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
        const category = await createComponentCategory(data)

        ctx.status = 201
        ctx.body = {
          content: ComponentCategorySchema.parse(category),
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
   * /component-categories/{id}:
   *   put:
   *     summary: Update a component category
   *     description: Updates category name or metadata.
   *     tags: [Component Categories]
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
   *             $ref: '#/components/schemas/UpdateComponentCategoryRequest'
   *     responses:
   *       200:
   *         description: Component category updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentCategory'
   *       404:
   *         description: Component category not found
   */
  router.put(
    '(.*)/component-categories/:id',
    parseRequest({
      body: UpdateComponentCategorySchema,
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
        const existing = await getComponentCategoryById(id)
        if (!existing) {
          ctx.status = 404
          ctx.body = { error: 'Component category not found', ...metadata }
          return
        }

        const category = await updateComponentCategory(id, data)

        ctx.body = {
          content: ComponentCategorySchema.parse(category),
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
   * /component-categories/{id}:
   *   delete:
   *     summary: Delete a component category
   *     description: Removes a category. Will fail if category has associated types.
   *     tags: [Component Categories]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Component category deleted successfully
   *       404:
   *         description: Component category not found
   */
  router.delete('(.*)/component-categories/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const idResult = z.string().uuid().safeParse(ctx.params.id)
    if (!idResult.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid UUID format', ...metadata }
      return
    }
    const id = idResult.data

    try {
      const existing = await getComponentCategoryById(id)
      if (!existing) {
        ctx.status = 404
        ctx.body = { error: 'Component category not found', ...metadata }
        return
      }

      await deleteComponentCategory(id)
      ctx.status = 204
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      // Check for foreign key constraint violation (Prisma P2003)
      const isPrismaFKError =
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2003'
      if (isPrismaFKError) {
        ctx.status = 409
        ctx.body = {
          error: 'Cannot delete category with dependent types',
          ...metadata,
        }
        return
      }
      ctx.status = 500
      ctx.body = { error: errorMessage, ...metadata }
    }
  })
}
