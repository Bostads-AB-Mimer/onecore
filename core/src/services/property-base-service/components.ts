import KoaRouter from '@koa/router'
import { z } from 'zod'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'

import { logger, generateRouteMetadata } from '@onecore/utilities'
import * as schemas from './schemas'
import { addComponent } from '../../processes/components'
import { ProcessStatus } from '../../common/types'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /components/by-room/{roomId}:
   *   get:
   *     summary: Get components by room ID
   *     tags:
   *       - Property-base/Components
   *     description: |
   *       Returns all components currently installed in a specific space via their installation records.
   *       Components are returned ordered by installation date (newest first).
   *     parameters:
   *       - in: path
   *         name: roomId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the room
   *     responses:
   *       '200':
   *         description: Successfully retrieved the components list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Component'
   *       '404':
   *         description: Room not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Room not found
   *       '500':
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/components/by-room/:roomId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { roomId } = ctx.params

    try {
      const result = await propertyBaseAdapter.getComponentsByRoomId(roomId)

      if (!result.ok) {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Room not found', ...metadata }
          return
        }

        logger.error({ err: result.err, metadata }, 'Internal server error')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Component[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT CATEGORIES ====================

  /**
   * @swagger
   * /component-categories:
   *   get:
   *     summary: Get all component categories
   *     description: Top-level groupings for building components (e.g., Ventilation, VVS, Vitvaror, Tak). Use categoryId to filter component types.
   *     tags:
   *       - Property-base/Components
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
   *           default: 50
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-categories', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentCategoriesQueryParamsSchema.safeParse(
      ctx.query
    )
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentCategories(
        params.data.page,
        params.data.limit
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentCategory[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-categories/{id}:
   *   get:
   *     summary: Get component category by ID
   *     description: Returns a single category with its name and metadata.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-categories/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentCategoryById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component category not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentCategory,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-categories:
   *   post:
   *     summary: Create a new component category
   *     description: Creates a new top-level category for organizing component types.
   *     tags:
   *       - Property-base/Components
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentCategoryRequest'
   *     responses:
   *       201:
   *         description: Component category created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentCategory'
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-categories', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentCategorySchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentCategory(
        body.data
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentCategory,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-categories/{id}:
   *   put:
   *     summary: Update a component category
   *     description: Updates category name or metadata.
   *     tags:
   *       - Property-base/Components
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
   *             $ref: '#/components/schemas/UpdateComponentCategoryRequest'
   *     responses:
   *       200:
   *         description: Component category updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentCategory'
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-categories/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentCategorySchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentCategory(
        id.data,
        body.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component category not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentCategory,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-categories/{id}:
   *   delete:
   *     summary: Delete a component category
   *     description: Removes a category. Will fail if category has associated types.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component category deleted
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-categories/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentCategory(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component category not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT TYPES ====================

  /**
   * @swagger
   * /component-types:
   *   get:
   *     summary: Get all component types
   *     description: Specific kinds of components within a category (e.g., Diskmaskin, Värmepump, Takbeläggning). Filter by categoryId to get types for a specific category.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-types', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentTypesQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentTypes(
        params.data.categoryId,
        params.data.page,
        params.data.limit
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentType[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-types/{id}:
   *   get:
   *     summary: Get component type by ID
   *     description: Returns a single type with its category relationship.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-types/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentTypeById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component type not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentType,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-types:
   *   post:
   *     summary: Create a new component type
   *     description: Creates a new type within a category. Requires categoryId.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-types', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentTypeSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentType(body.data)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentType,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-types/{id}:
   *   put:
   *     summary: Update a component type
   *     description: Updates type name or category assignment.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-types/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentTypeSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentType(
        id.data,
        body.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component type not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentType,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-types/{id}:
   *   delete:
   *     summary: Delete a component type
   *     description: Removes a type. Will fail if type has associated subtypes.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component type deleted
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-types/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentType(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component type not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT SUBTYPES ====================

  /**
   * @swagger
   * /component-subtypes:
   *   get:
   *     summary: Get all component subtypes
   *     description: "Variants of a type with lifecycle data including depreciation price, technical/economic lifespan, and replacement interval. Filter by typeId or subtypeName."
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: query
   *         name: typeId
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filter subtypes by type ID
   *       - in: query
   *         name: subtypeName
   *         required: false
   *         schema:
   *           type: string
   *         description: Search subtypes by name (case-insensitive)
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-subtypes', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentSubtypesQueryParamsSchema.safeParse(
      ctx.query
    )
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentSubtypes(
        params.data.typeId,
        params.data.page,
        params.data.limit,
        params.data.subtypeName
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentSubtype[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-subtypes/{id}:
   *   get:
   *     summary: Get component subtype by ID
   *     description: Returns subtype with full lifecycle and cost planning data.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-subtypes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentSubtypeById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component subtype not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentSubtype,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-subtypes:
   *   post:
   *     summary: Create a new component subtype
   *     description: Creates a subtype with lifecycle parameters. Requires typeId.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-subtypes', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentSubtypeSchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentSubtype(body.data)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentSubtype,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-subtypes/{id}:
   *   put:
   *     summary: Update a component subtype
   *     description: Updates subtype specifications or lifecycle data.
   *     tags:
   *       - Property-base/Components
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
   *       404:
   *         description: Component subtype not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-subtypes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentSubtypeSchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentSubtype(
        id.data,
        body.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component subtype not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentSubtype,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-subtypes/{id}:
   *   delete:
   *     summary: Delete a component subtype
   *     description: Removes a subtype. Will fail if subtype has associated models.
   *     tags:
   *       - Property-base/Components
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
   *       404:
   *         description: Component subtype not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-subtypes/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentSubtype(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component subtype not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT MODELS ====================

  /**
   * @swagger
   * /component-models:
   *   get:
   *     summary: Get all component models
   *     description: Specific manufacturer products with pricing, warranty, specifications, and dimensions. Filter by subtypeId, manufacturer, or modelName.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-models', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentModelsQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentModels(
        params.data.componentTypeId,
        params.data.subtypeId,
        params.data.manufacturer,
        params.data.page,
        params.data.limit,
        params.data.modelName
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentModel[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /documents/component-models/{id}:
   *   get:
   *     summary: Get all documents for a component model
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component model ID
   *     responses:
   *       200:
   *         description: Array of documents with presigned URLs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/DocumentWithUrl'
   *       404:
   *         description: Component model not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/documents/component-models/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentModelDocuments(
        id.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component model not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = result.data
    } catch (error) {
      logger.error(
        { error, metadata },
        'Failed to get component model documents'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-models/{id}:
   *   get:
   *     summary: Get component model by ID
   *     description: Returns full model details including specs and current pricing.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-models/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentModelById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component model not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentModel,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-models:
   *   post:
   *     summary: Create a new component model
   *     description: Creates a manufacturer product entry. Requires subtypeId.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-models', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentModelSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentModel(body.data)

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentModel,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-models/{id}:
   *   put:
   *     summary: Update a component model
   *     description: Updates model pricing, specs, or warranty info.
   *     tags:
   *       - Property-base/Components
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
   *       404:
   *         description: Component model not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-models/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentModelSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentModel(
        id.data,
        body.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component model not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentModel,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-models/{id}:
   *   delete:
   *     summary: Delete a component model
   *     description: Removes a model. Will fail if model has associated components.
   *     tags:
   *       - Property-base/Components
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
   *       404:
   *         description: Component model not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-models/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentModel(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component model not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENTS ====================

  /**
   * @swagger
   * /components:
   *   get:
   *     summary: Get all components
   *     description: Physical units with serial numbers and status. Filter by modelId, status (ACTIVE/INACTIVE/MAINTENANCE/DECOMMISSIONED), or serialNumber.
   *     tags:
   *       - Property-base/Components
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
   *         description: List of components
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/components', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentsQueryParamsSchema.safeParse(ctx.query)
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponents(
        params.data.modelId,
        params.data.status,
        params.data.page,
        params.data.limit,
        params.data.serialNumber
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Component[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /components/{id}:
   *   get:
   *     summary: Get component by ID
   *     description: Returns full component details including purchase info, warranty dates, and current status.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Component details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Component'
   *       404:
   *         description: Component not found
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/components/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentById(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Component,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /components:
   *   post:
   *     summary: Create a new component
   *     description: Registers a new physical unit. Requires modelId and serialNumber.
   *     tags:
   *       - Property-base/Components
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateComponentRequest'
   *     responses:
   *       201:
   *         description: Component created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Component'
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/components', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponent({
        ...body.data,
        warrantyStartDate: body.data.warrantyStartDate?.toISOString(),
      })

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Component,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /components/{id}:
   *   put:
   *     summary: Update a component
   *     description: Updates component status, warranty dates, or other attributes.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateComponentRequest'
   *     responses:
   *       200:
   *         description: Component updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/Component'
   *       404:
   *         description: Component not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/components/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentSchema.safeParse(ctx.request.body)
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponent(id.data, {
        ...body.data,
        warrantyStartDate: body.data.warrantyStartDate?.toISOString(),
      })

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.Component,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /components/{id}:
   *   delete:
   *     summary: Delete a component
   *     description: Removes a component record. Automatically deletes associated installation records.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Component deleted
   *       404:
   *         description: Component not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/components/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponent(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT INSTALLATIONS ====================

  /**
   * @swagger
   * /component-installations:
   *   get:
   *     summary: Get all component installations
   *     description: Placement records linking components to property locations (spaceId). A component can be moved between locations over time. Filter by componentId, spaceId, or buildingPartId.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-installations', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const params = schemas.ComponentInstallationsQueryParamsSchema.safeParse(
      ctx.query
    )
    if (!params.success) {
      ctx.status = 400
      ctx.body = { error: params.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentInstallations(
        params.data.componentId,
        params.data.spaceId,
        undefined,
        params.data.page,
        params.data.limit
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentInstallation[],
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-installations/{id}:
   *   get:
   *     summary: Get component installation by ID
   *     description: Returns installation record with dates, location, order number, and cost.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/component-installations/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentInstallationById(
        id.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component installation not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentInstallation,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-installations:
   *   post:
   *     summary: Create a new component installation
   *     description: Records a component being installed at a location. Requires componentId and spaceId.
   *     tags:
   *       - Property-base/Components
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
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-installations', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.CreateComponentInstallationSchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.createComponentInstallation({
        ...body.data,
        installationDate: body.data.installationDate.toISOString(),
        deinstallationDate: body.data.deinstallationDate?.toISOString(),
      })

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentInstallation,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-installations/{id}:
   *   put:
   *     summary: Update a component installation
   *     description: Updates installation details or records deinstallation date.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component installation ID
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
   *       404:
   *         description: Component installation not found
   *     security:
   *       - bearerAuth: []
   */
  router.put('(.*)/component-installations/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    const body = schemas.UpdateComponentInstallationSchema.safeParse(
      ctx.request.body
    )
    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.updateComponentInstallation(
        id.data,
        {
          ...body.data,
          installationDate: body.data.installationDate?.toISOString(),
          deinstallationDate: body.data.deinstallationDate?.toISOString(),
        }
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component installation not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.ComponentInstallation,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /component-installations/{id}:
   *   delete:
   *     summary: Delete a component installation
   *     description: Removes an installation record.
   *     tags:
   *       - Property-base/Components
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
   *       404:
   *         description: Component installation not found
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/component-installations/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentInstallation(
        id.data
      )

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component installation not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT FILE UPLOAD ROUTES ====================

  /**
   * @swagger
   * /components/{id}/upload:
   *   post:
   *     summary: Upload a file to a component
   *     description: Attach photos or documents to a specific component (e.g., installation photos, receipts).
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - fileData
   *               - fileName
   *               - contentType
   *             properties:
   *               fileData:
   *                 type: string
   *                 description: Base64 encoded file data
   *               fileName:
   *                 type: string
   *                 description: Original file name
   *               contentType:
   *                 type: string
   *                 description: MIME type of the file
   *               caption:
   *                 type: string
   *                 description: Optional caption for the file
   *     responses:
   *       200:
   *         description: File uploaded successfully
   *       400:
   *         description: Bad request
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/components/:id/upload', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const { fileData, fileName, contentType, caption } = ctx.request.body as {
        fileData?: string
        fileName?: string
        contentType?: string
        caption?: string
      }

      if (!fileData || !fileName || !contentType) {
        ctx.status = 400
        ctx.body = {
          error: 'fileData, fileName, and contentType are required',
          ...metadata,
        }
        return
      }

      const fileBuffer = Buffer.from(fileData, 'base64')

      const result = await propertyBaseAdapter.uploadComponentFile(
        id.data,
        fileBuffer,
        fileName,
        contentType,
        caption
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Upload failed', ...metadata }
        return
      }

      ctx.body = { content: result.data, ...metadata }
    } catch (error) {
      logger.error({ error, metadata }, 'Failed to upload component file')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /documents/component-instances/{id}:
   *   get:
   *     summary: Get all documents for a component
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component ID
   *     responses:
   *       200:
   *         description: Array of documents with presigned URLs
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/DocumentWithUrl'
   *       404:
   *         description: Component not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/documents/component-instances/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.getComponentFiles(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Component not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.body = result.data
    } catch (error) {
      logger.error({ error, metadata }, 'Failed to get component files')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /documents/{id}:
   *   delete:
   *     summary: Delete a document by ID
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Document ID
   *     responses:
   *       204:
   *         description: Document deleted successfully
   *       404:
   *         description: Document not found
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.delete('(.*)/documents/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid document ID format', ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.deleteComponentFile(id.data)

      if (!result.ok) {
        ctx.status = result.err === 'not_found' ? 404 : 500
        ctx.body = {
          error:
            result.err === 'not_found'
              ? 'Document not found'
              : 'Internal server error',
          ...metadata,
        }
        return
      }

      ctx.status = 204
    } catch (error) {
      logger.error({ error, metadata }, 'Failed to delete document')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== COMPONENT MODEL DOCUMENT UPLOAD ROUTES ====================

  /**
   * @swagger
   * /component-models/{id}/upload:
   *   post:
   *     summary: Upload a document to a component model
   *     description: Attach product documentation, manuals, or spec sheets to a model for reference.
   *     tags:
   *       - Property-base/Components
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component model ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - fileData
   *               - fileName
   *               - contentType
   *             properties:
   *               fileData:
   *                 type: string
   *                 description: Base64 encoded file data
   *               fileName:
   *                 type: string
   *                 description: Original file name
   *               contentType:
   *                 type: string
   *                 description: MIME type of the file
   *     responses:
   *       200:
   *         description: Document uploaded successfully
   *       400:
   *         description: Bad request
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/component-models/:id/upload', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const id = z.string().uuid().safeParse(ctx.params.id)
    if (!id.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid ID format', ...metadata }
      return
    }

    try {
      const { fileData, fileName, contentType } = ctx.request.body as {
        fileData?: string
        fileName?: string
        contentType?: string
      }

      if (!fileData || !fileName || !contentType) {
        ctx.status = 400
        ctx.body = {
          error: 'fileData, fileName, and contentType are required',
          ...metadata,
        }
        return
      }

      const fileBuffer = Buffer.from(fileData, 'base64')

      // Normalize Swedish characters to ASCII equivalents
      // This avoids encoding issues entirely by removing non-ASCII characters
      const normalizeFilename = (filename: string): string => {
        return filename
          .replace(/Ö/g, 'O')
          .replace(/Ä/g, 'A')
          .replace(/Å/g, 'A')
          .replace(/ö/g, 'o')
          .replace(/ä/g, 'a')
          .replace(/å/g, 'a')
      }

      const normalizedFilename = normalizeFilename(fileName)

      const result = await propertyBaseAdapter.uploadComponentModelDocument(
        id.data,
        fileBuffer,
        normalizedFilename,
        contentType
      )

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: 'Upload failed', ...metadata }
        return
      }

      ctx.body = { content: result.data, ...metadata }
    } catch (error) {
      logger.error(
        { error, metadata },
        'Failed to upload component model document'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * @swagger
   * /components/analyze-image:
   *   post:
   *     summary: Analyze component image(s) using AI
   *     description: Upload photos to identify component type, model, or condition using AI image analysis. Can accept a typeplate/label image, product photo, or both for improved accuracy.
   *     tags:
   *       - Property-base/Components
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AnalyzeComponentImageRequest'
   *     responses:
   *       200:
   *         description: Component analysis successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/AIComponentAnalysis'
   *       400:
   *         description: Invalid request (e.g., image too large, missing required fields)
   *       500:
   *         description: AI analysis failed
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/components/analyze-image', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.AnalyzeComponentImageRequestSchema.safeParse(
      ctx.request.body
    )

    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await propertyBaseAdapter.analyzeComponentImage(body.data)

      if (!result.ok) {
        ctx.status = result.statusCode ?? 500
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.body = {
        content: result.data satisfies schemas.AIComponentAnalysis,
        ...metadata,
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Internal server error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // ==================== PROCESSES ====================

  /**
   * @swagger
   * /processes/add-component:
   *   post:
   *     summary: Add a component with model, instance, and installation
   *     tags:
   *       - Property-base/Components
   *     description: |
   *       Unified process to add a component. This handles:
   *       1. Finding or creating a component model (by exact modelName match)
   *       2. Creating a component instance
   *       3. Creating a component installation
   *
   *       If the model doesn't exist, it will be created. In this case, the model fields
   *       (manufacturer, currentPrice, currentInstallPrice, modelWarrantyMonths) are required.
   *
   *       Categories, types, and subtypes must be created manually beforehand.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - modelName
   *               - componentSubtypeId
   *               - serialNumber
   *               - componentWarrantyMonths
   *               - priceAtPurchase
   *               - depreciationPriceAtPurchase
   *               - economicLifespan
   *               - spaceId
   *               - spaceType
   *               - installationDate
   *               - installationCost
   *             properties:
   *               modelName:
   *                 type: string
   *                 description: Model name (used to find existing model or create new one)
   *               componentSubtypeId:
   *                 type: string
   *                 format: uuid
   *                 description: Subtype ID (must exist)
   *               manufacturer:
   *                 type: string
   *                 description: Required if model doesn't exist
   *               currentPrice:
   *                 type: number
   *                 description: Required if model doesn't exist
   *               currentInstallPrice:
   *                 type: number
   *                 description: Required if model doesn't exist
   *               modelWarrantyMonths:
   *                 type: integer
   *                 description: Required if model doesn't exist
   *               technicalSpecification:
   *                 type: string
   *               dimensions:
   *                 type: string
   *               coclassCode:
   *                 type: string
   *               serialNumber:
   *                 type: string
   *               specifications:
   *                 type: string
   *               additionalInformation:
   *                 type: string
   *               warrantyStartDate:
   *                 type: string
   *                 format: date-time
   *                 description: ISO-8601 DateTime format (e.g., 2026-01-01T00:00:00.000Z)
   *               componentWarrantyMonths:
   *                 type: integer
   *               priceAtPurchase:
   *                 type: number
   *               depreciationPriceAtPurchase:
   *                 type: number
   *               economicLifespan:
   *                 type: number
   *               quantity:
   *                 type: number
   *                 default: 1
   *               ncsCode:
   *                 type: string
   *                 description: NCS color code
   *               status:
   *                 type: string
   *                 enum: [ACTIVE, INACTIVE, MAINTENANCE, DECOMMISSIONED]
   *                 default: ACTIVE
   *               condition:
   *                 type: string
   *                 enum: [NEW, GOOD, FAIR, POOR, DAMAGED]
   *                 nullable: true
   *                 description: Physical condition of the component (optional)
   *               spaceId:
   *                 type: string
   *                 description: Where to install the component
   *               spaceType:
   *                 type: string
   *                 enum: [OBJECT, PropertyObject]
   *               installationDate:
   *                 type: string
   *               orderNumber:
   *                 type: string
   *               installationCost:
   *                 type: number
   *     responses:
   *       201:
   *         description: Component added successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     modelCreated:
   *                       type: boolean
   *                     model:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         modelName:
   *                           type: string
   *                         manufacturer:
   *                           type: string
   *                     component:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         serialNumber:
   *                           type: string
   *                         status:
   *                           type: string
   *                     installation:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         spaceId:
   *                           type: string
   *                         installationDate:
   *                           type: string
   *       400:
   *         description: Validation error or missing required model fields
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/processes/add-component', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const body = schemas.AddComponentRequestSchema.safeParse(ctx.request.body)

    if (!body.success) {
      ctx.status = 400
      ctx.body = { error: body.error.errors, ...metadata }
      return
    }

    try {
      const result = await addComponent(body.data)

      ctx.status = result.httpStatus
      if (result.processStatus === ProcessStatus.successful) {
        ctx.body = {
          content: result.data,
          ...result.response,
          ...metadata,
        }
      } else {
        ctx.body = {
          error: result.error,
          ...result.response,
          ...metadata,
        }
      }
    } catch (error) {
      logger.error({ error, metadata }, 'Add component process error')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
