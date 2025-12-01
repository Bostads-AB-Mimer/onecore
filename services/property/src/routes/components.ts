import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import { deleteFile } from '../adapters/minio-adapter'
import {
  createMulterUpload,
  generateFileName,
  uploadAndSaveMetadata,
  addPresignedUrls,
} from '../utils/file-upload'
import {
  componentCategoriesQueryParamsSchema,
  ComponentCategorySchema,
  CreateComponentCategorySchema,
  UpdateComponentCategorySchema,
  componentTypesQueryParamsSchema,
  ComponentTypeSchema,
  CreateComponentTypeSchema,
  UpdateComponentTypeSchema,
  componentSubtypesQueryParamsSchema,
  ComponentSubtypeSchema,
  CreateComponentSubtypeSchema,
  UpdateComponentSubtypeSchema,
  componentModelsQueryParamsSchema,
  ComponentModelSchema,
  CreateComponentModelSchema,
  UpdateComponentModelSchema,
  componentsNewQueryParamsSchema,
  ComponentNewSchema,
  CreateComponentNewSchema,
  UpdateComponentNewSchema,
  componentInstallationsQueryParamsSchema,
  ComponentInstallationSchema,
  CreateComponentInstallationSchema,
  UpdateComponentInstallationSchema,
} from '../types/component'
import {
  getComponentCategories,
  getComponentCategoryById,
  createComponentCategory,
  updateComponentCategory,
  deleteComponentCategory,
  getComponentTypes,
  getComponentTypeById,
  createComponentType,
  updateComponentType,
  deleteComponentType,
  getComponentSubtypes,
  getComponentSubtypeById,
  createComponentSubtype,
  updateComponentSubtype,
  deleteComponentSubtype,
  getComponentModels,
  getComponentModelById,
  createComponentModel,
  updateComponentModel,
  deleteComponentModel,
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  getComponentInstallations,
  getComponentInstallationById,
  createComponentInstallation,
  updateComponentInstallation,
  deleteComponentInstallation,
  getComponentsByRoomId,
  getComponentModelDocuments,
  addComponentModelDocument,
  removeComponentModelDocument,
  getComponentFiles,
  addComponentFile,
  removeComponentFile,
} from '../adapters/component-adapter'

/**
 * @swagger
 * tags:
 *   - name: Component Categories
 *     description: Operations for managing component categories
 *   - name: Component Types
 *     description: Operations for managing component types
 *   - name: Component Subtypes
 *     description: Operations for managing component subtypes
 *   - name: Component Models
 *     description: Operations for managing component models
 *   - name: Components New
 *     description: Operations for managing component instances
 *   - name: Component Installations
 *     description: Operations for managing component installations
 */
export const routes = (router: KoaRouter) => {
  // ==================== COMPONENT CATEGORIES ROUTES ====================

  /**
   * @swagger
   * /component-categories:
   *   get:
   *     summary: Get all component categories
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

  router.get('(.*)/component-categories/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

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

  router.put(
    '(.*)/component-categories/:id',
    parseRequest({
      body: UpdateComponentCategorySchema,
    }),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
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

  router.delete('(.*)/component-categories/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      await deleteComponentCategory(id)
      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  // ==================== COMPONENT TYPES ROUTES ====================

  /**
   * @swagger
   * /component-types:
   *   get:
   *     summary: Get all component types
   *     tags: [Component Types]
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

  // ==================== COMPONENT SUBTYPES ROUTES ====================

  /**
   * @swagger
   * /component-subtypes:
   *   get:
   *     summary: Get all component subtypes
   *     tags: [Component Subtypes]
   *     parameters:
   *       - in: query
   *         name: componentTypeId
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
      const { typeId, page, limit } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentSubtypes(typeId, page, limit)

        ctx.body = {
          content: ComponentSubtypeSchema.array().parse(result.subtypes),
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

  // ==================== COMPONENT MODELS ROUTES ====================

  /**
   * @swagger
   * /component-models:
   *   get:
   *     summary: Get all component models
   *     tags: [Component Models]
   *     parameters:
   *       - in: query
   *         name: componentTypeId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: subtypeId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: manufacturer
   *         schema:
   *           type: string
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
      const { componentSubtypeId, manufacturer, page, limit } =
        ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentModels(
          { componentSubtypeId, manufacturer },
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
   * /component-models/{id}:
   *   get:
   *     summary: Get component model by ID
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

  // ==================== COMPONENTS ROUTES ====================

  /**
   * @swagger
   * /components:
   *   get:
   *     summary: Get all component instances
   *     tags: [Components]
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
      const { modelId, status, page, limit } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponents({ modelId, status }, page, limit)

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
   *     tags: [Components]
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
   *     tags: [Components]
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
   *   put:
   *     summary: Update a component instance
   *     tags: [Components]
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
   *     tags: [Components]
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
   *     tags: [Components]
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
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  // ==================== COMPONENT INSTALLATIONS ROUTES ====================

  /**
   * @swagger
   * /component-installations:
   *   get:
   *     summary: Get all component installations
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
      const { componentId, spaceId, page, limit } =
        ctx.request.parsedQuery
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
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

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
   *   put:
   *     summary: Update a component installation
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
      const id = z.string().uuid().parse(ctx.params.id)
      const data = ctx.request.parsedBody
      const metadata = generateRouteMetadata(ctx)

      try {
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
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      await deleteComponentInstallation(id)
      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  // ==================== FILE UPLOAD ROUTES ====================

  // Configure multer for image uploads (components)
  const imageUpload = createMulterUpload({
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    errorMessage:
      'Endast JPEG-, PNG- och WebP-bilder är tillåtna. Max storlek är 50MB.',
  })

  // Configure multer for document uploads (component models)
  // Note: Only PDFs are supported for documents. Word/Excel files should be converted to PDF before upload.
  const documentUpload = createMulterUpload({
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['application/pdf'],
    errorMessage:
      'Endast PDF-filer är tillåtna. Konvertera Word- eller Excel-dokument till PDF innan uppladdning.',
  })

  /**
   * @swagger
   * /component-models/{id}/upload:
   *   post:
   *     summary: Upload a document to a component model
   *     tags: [Component Models]
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
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: PDF document file (max 50MB)
   *             required:
   *               - file
   *     responses:
   *       200:
   *         description: Document uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentModelDocument'
   *       400:
   *         description: Invalid file type or size
   *       500:
   *         description: Upload failed
   */
  router.post(
    '(.*)/component-models/:id/upload',
    documentUpload.single('file'),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const metadata = generateRouteMetadata(ctx)

      try {
        const file = ctx.file
        if (!file) {
          ctx.status = 400
          ctx.body = { error: 'Ingen fil uppladdad', ...metadata }
          return
        }

        // Explicit PDF validation (defense in depth)
        if (file.mimetype !== 'application/pdf') {
          ctx.status = 400
          ctx.body = {
            error:
              'Endast PDF-filer är tillåtna för komponentmodellsdokumentation',
            ...metadata,
          }
          return
        }

        // Explicit file size validation (defense in depth)
        const maxSize = 50 * 1024 * 1024 // 50MB
        if (file.size > maxSize) {
          ctx.status = 400
          ctx.body = {
            error: `Filen är för stor. Max storlek är ${Math.round(maxSize / 1024 / 1024)}MB`,
            ...metadata,
          }
          return
        }

        // Validate file extension matches PDF
        const extension = file.originalname.split('.').pop()?.toLowerCase()
        if (extension !== 'pdf') {
          ctx.status = 400
          ctx.body = {
            error: 'Filtillägget måste vara .pdf',
            ...metadata,
          }
          return
        }

        // Generate unique filename
        const fileName = generateFileName({
          entityType: 'component-model',
          entityId: id,
          originalName: file.originalname,
        })

        // Upload to MinIO and save metadata to database
        const document = await uploadAndSaveMetadata({
          file,
          fileName,
          metadataHandler: async (fileId, sanitizedFile) => {
            await addComponentModelDocument(id, fileId)
            return { fileId, originalName: sanitizedFile.originalname }
          },
        })

        ctx.body = {
          content: document,
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
   * /component-models/{id}/documents:
   *   get:
   *     summary: Get all documents for a component model with presigned URLs
   *     tags: [Component Models]
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
   *         description: List of documents with download URLs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     documents:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/FileMetadataWithUrl'
   *                     count:
   *                       type: number
   *       404:
   *         description: Component model not found
   *       500:
   *         description: Failed to retrieve documents
   */
  router.get('(.*)/component-models/:id/documents', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const documents = await getComponentModelDocuments(id)

      // Generate presigned URLs for each document (24 hour expiry)
      const documentsWithUrls = await addPresignedUrls(documents, 86400)

      ctx.body = {
        content: {
          documents: documentsWithUrls,
          count: documentsWithUrls.length,
        },
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
   * /component-models/{id}/documents/{fileId}:
   *   delete:
   *     summary: Delete a document from a component model
   *     tags: [Component Models]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: path
   *         name: fileId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Document deleted successfully
   */
  router.delete('(.*)/component-models/:id/documents/:fileId', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const fileId = z.string().parse(ctx.params.fileId)
    const metadata = generateRouteMetadata(ctx)

    try {
      // Delete from MinIO
      await deleteFile(fileId)

      // Remove from database
      await removeComponentModelDocument(id, fileId)

      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /components/{id}/upload:
   *   post:
   *     summary: Upload images to a component
   *     tags: [Components New]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *       - in: query
   *         name: caption
   *         schema:
   *           type: string
   *         description: Optional image caption
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: Image file (JPEG, PNG, or WebP, max 50MB)
   *             required:
   *               - file
   *     responses:
   *       200:
   *         description: Image uploaded successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ComponentFile'
   *       400:
   *         description: Invalid file type or size
   *       500:
   *         description: Upload failed
   */
  router.post(
    '(.*)/components/:id/upload',
    imageUpload.single('file'),
    async (ctx) => {
      const id = z.string().uuid().parse(ctx.params.id)
      const metadata = generateRouteMetadata(ctx)

      try {
        const file = ctx.file
        if (!file) {
          ctx.status = 400
          ctx.body = { error: 'Ingen fil uppladdad', ...metadata }
          return
        }

        // Explicit image type validation (defense in depth)
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowedMimeTypes.includes(file.mimetype)) {
          ctx.status = 400
          ctx.body = {
            error: 'Endast JPEG-, PNG- och WebP-bilder är tillåtna',
            ...metadata,
          }
          return
        }

        // Explicit file size validation (defense in depth)
        const maxSize = 50 * 1024 * 1024 // 50MB
        if (file.size > maxSize) {
          ctx.status = 400
          ctx.body = {
            error: `Bilden är för stor. Max storlek är ${Math.round(maxSize / 1024 / 1024)}MB`,
            ...metadata,
          }
          return
        }

        // Validate file extension matches image type
        const extension = file.originalname.split('.').pop()?.toLowerCase()
        const validExtensions = ['jpg', 'jpeg', 'png', 'webp']
        if (!extension || !validExtensions.includes(extension)) {
          ctx.status = 400
          ctx.body = {
            error: 'Filtillägget måste vara .jpg, .jpeg, .png eller .webp',
            ...metadata,
          }
          return
        }

        // Generate unique filename
        const fileName = generateFileName({
          entityType: 'component',
          entityId: id,
          originalName: file.originalname,
        })

        // Upload to MinIO and save metadata to database
        const componentFile = await uploadAndSaveMetadata({
          file,
          fileName,
          metadataHandler: async (fileId, sanitizedFile) => {
            await addComponentFile(id, fileId)
            return { fileId, originalName: sanitizedFile.originalname }
          },
        })

        ctx.body = {
          content: componentFile,
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
   * /components/{id}/files:
   *   get:
   *     summary: Get all files for a component with presigned URLs
   *     tags: [Components New]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Component instance ID
   *     responses:
   *       200:
   *         description: List of files with download URLs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     files:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/FileMetadataWithUrl'
   *                     count:
   *                       type: number
   *       404:
   *         description: Component not found
   *       500:
   *         description: Failed to retrieve files
   */
  router.get('(.*)/components/:id/files', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const files = await getComponentFiles(id)

      // Generate presigned URLs for each file (24 hour expiry)
      const filesWithUrls = await addPresignedUrls(files, 86400)

      ctx.body = {
        content: {
          files: filesWithUrls,
          count: filesWithUrls.length,
        },
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
   * /components/{id}/files/{fileId}:
   *   delete:
   *     summary: Delete a file from a component
   *     tags: [Components New]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: path
   *         name: fileId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: File deleted successfully
   */
  router.delete('(.*)/components/:id/files/:fileId', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const fileId = z.string().parse(ctx.params.fileId)
    const metadata = generateRouteMetadata(ctx)

    try {
      // Delete from MinIO
      await deleteFile(fileId)

      // Remove from database
      await removeComponentFile(id, fileId)

      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { error: errorMessage, ...metadata }
    }
  })
}
