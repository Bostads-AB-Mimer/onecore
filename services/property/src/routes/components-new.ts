import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { parseRequest } from '../middleware/parse-request'
import { z } from 'zod'
import {
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
} from '../types/components-new'
import {
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
} from '../adapters/components-new-adapter'

/**
 * @swagger
 * tags:
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
   */
  router.get(
    '(.*)/component-types',
    parseRequest({ query: componentTypesQueryParamsSchema }),
    async (ctx) => {
      const { page, limit } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentTypes(page, limit)

        ctx.body = {
          content: ComponentTypeSchema.array().parse(result.types),
          pagination: result.pagination,
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
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
        ctx.body = { reason: 'Component type not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentTypeSchema.parse(type),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
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
   *             type: object
   *             properties:
   *               description:
   *                 type: string
   *     responses:
   *       201:
   *         description: Component type created
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
        ctx.body = { reason: errorMessage, ...metadata }
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
   *     responses:
   *       200:
   *         description: Component type updated
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
        ctx.body = { reason: errorMessage, ...metadata }
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
      ctx.body = { reason: errorMessage, ...metadata }
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
   */
  router.get(
    '(.*)/component-subtypes',
    parseRequest({ query: componentSubtypesQueryParamsSchema }),
    async (ctx) => {
      const { componentTypeId, page, limit } = ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentSubtypes(componentTypeId, page, limit)

        ctx.body = {
          content: ComponentSubtypeSchema.array().parse(result.subtypes),
          pagination: result.pagination,
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
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
        ctx.body = { reason: 'Component subtype not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentSubtypeSchema.parse(subtype),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
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
   *             type: object
   *             required:
   *               - componentTypeId
   *               - description
   *             properties:
   *               componentTypeId:
   *                 type: string
   *                 format: uuid
   *               description:
   *                 type: string
   *     responses:
   *       201:
   *         description: Component subtype created
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
        ctx.body = { reason: errorMessage, ...metadata }
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
   *             type: object
   *             properties:
   *               componentTypeId:
   *                 type: string
   *                 format: uuid
   *               description:
   *                 type: string
   *     responses:
   *       200:
   *         description: Component subtype updated
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
        ctx.body = { reason: errorMessage, ...metadata }
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
      ctx.body = { reason: errorMessage, ...metadata }
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
   */
  router.get(
    '(.*)/component-models',
    parseRequest({ query: componentModelsQueryParamsSchema }),
    async (ctx) => {
      const { componentTypeId, subtypeId, manufacturer, page, limit } =
        ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentModels(
          { componentTypeId, subtypeId, manufacturer },
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
        ctx.body = { reason: errorMessage, ...metadata }
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
        ctx.body = { reason: 'Component model not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentModelSchema.parse(model),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
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
   *             type: object
   *             required:
   *               - componentTypeId
   *               - subtypeId
   *               - currentPrice
   *               - warrantyMonths
   *               - manufacturer
   *               - technicalLifespan
   *               - economicLifespan
   *               - replacementIntervalMonths
   *               - quantityType
   *               - coclassCode
   *             properties:
   *               componentTypeId:
   *                 type: string
   *                 format: uuid
   *               subtypeId:
   *                 type: string
   *                 format: uuid
   *               currentPrice:
   *                 type: number
   *               warrantyMonths:
   *                 type: integer
   *               manufacturer:
   *                 type: string
   *               technicalLifespan:
   *                 type: number
   *               technicalSpecification:
   *                 type: string
   *               installationInstructions:
   *                 type: string
   *               economicLifespan:
   *                 type: number
   *               dimensions:
   *                 type: string
   *               replacementIntervalMonths:
   *                 type: integer
   *               quantityType:
   *                 type: string
   *                 enum: [UNIT, METER, SQUARE_METER, CUBIC_METER]
   *               coclassCode:
   *                 type: string
   *     responses:
   *       201:
   *         description: Component model created
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
        ctx.body = { reason: errorMessage, ...metadata }
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
   *             type: object
   *             properties:
   *               componentTypeId:
   *                 type: string
   *                 format: uuid
   *               subtypeId:
   *                 type: string
   *                 format: uuid
   *               currentPrice:
   *                 type: number
   *               warrantyMonths:
   *                 type: integer
   *               manufacturer:
   *                 type: string
   *               technicalLifespan:
   *                 type: number
   *               technicalSpecification:
   *                 type: string
   *               installationInstructions:
   *                 type: string
   *               economicLifespan:
   *                 type: number
   *               dimensions:
   *                 type: string
   *               replacementIntervalMonths:
   *                 type: integer
   *               quantityType:
   *                 type: string
   *                 enum: [UNIT, METER, SQUARE_METER, CUBIC_METER]
   *               coclassCode:
   *                 type: string
   *     responses:
   *       200:
   *         description: Component model updated
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
        ctx.body = { reason: errorMessage, ...metadata }
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
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  // ==================== COMPONENTS NEW ROUTES ====================

  /**
   * @swagger
   * /components-new:
   *   get:
   *     summary: Get all component instances
   *     tags: [Components New]
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
   */
  router.get(
    '(.*)/components-new',
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
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components-new/{id}:
   *   get:
   *     summary: Get component instance by ID
   *     tags: [Components New]
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
   *       404:
   *         description: Component not found
   */
  router.get('(.*)/components-new/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      const component = await getComponentById(id)

      if (!component) {
        ctx.status = 404
        ctx.body = { reason: 'Component not found', ...metadata }
        return
      }

      ctx.body = {
        content: ComponentNewSchema.parse(component),
        ...metadata,
      }
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /components-new:
   *   post:
   *     summary: Create a new component instance
   *     tags: [Components New]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - modelId
   *               - serialNumber
   *               - warrantyMonths
   *               - priceAtPurchase
   *               - ncsCode
   *             properties:
   *               modelId:
   *                 type: string
   *                 format: uuid
   *               serialNumber:
   *                 type: string
   *               specifications:
   *                 type: string
   *               warrantyStartDate:
   *                 type: string
   *                 format: date
   *               warrantyMonths:
   *                 type: integer
   *               priceAtPurchase:
   *                 type: number
   *               ncsCode:
   *                 type: string
   *                 pattern: ^\d{3}(\.\d{3})?$
   *               status:
   *                 type: string
   *                 enum: [ACTIVE, INACTIVE, MAINTENANCE, DECOMMISSIONED]
   *     responses:
   *       201:
   *         description: Component instance created
   */
  router.post(
    '(.*)/components-new',
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
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components-new/{id}:
   *   put:
   *     summary: Update a component instance
   *     tags: [Components New]
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
   *             type: object
   *             properties:
   *               modelId:
   *                 type: string
   *                 format: uuid
   *               serialNumber:
   *                 type: string
   *               specifications:
   *                 type: string
   *               warrantyStartDate:
   *                 type: string
   *                 format: date
   *               warrantyMonths:
   *                 type: integer
   *               priceAtPurchase:
   *                 type: number
   *               ncsCode:
   *                 type: string
   *               status:
   *                 type: string
   *     responses:
   *       200:
   *         description: Component instance updated
   */
  router.put(
    '(.*)/components-new/:id',
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
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /components-new/{id}:
   *   delete:
   *     summary: Delete a component instance
   *     tags: [Components New]
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
  router.delete('(.*)/components-new/:id', async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id)
    const metadata = generateRouteMetadata(ctx)

    try {
      await deleteComponent(id)
      ctx.status = 204
    } catch (err) {
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
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
   */
  router.get(
    '(.*)/component-installations',
    parseRequest({ query: componentInstallationsQueryParamsSchema }),
    async (ctx) => {
      const { componentId, spaceId, buildingPartId, page, limit } =
        ctx.request.parsedQuery
      const metadata = generateRouteMetadata(ctx)

      try {
        const result = await getComponentInstallations(
          { componentId, spaceId, buildingPartId },
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
        ctx.body = { reason: errorMessage, ...metadata }
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
          reason: 'Component installation not found',
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
      ctx.body = { reason: errorMessage, ...metadata }
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
   *             type: object
   *             required:
   *               - componentId
   *               - installationDate
   *               - orderNumber
   *               - cost
   *             properties:
   *               componentId:
   *                 type: string
   *                 format: uuid
   *               spaceId:
   *                 type: string
   *                 format: uuid
   *               buildingPartId:
   *                 type: string
   *                 format: uuid
   *               installationDate:
   *                 type: string
   *                 format: date
   *               deinstallationDate:
   *                 type: string
   *                 format: date
   *               orderNumber:
   *                 type: string
   *               cost:
   *                 type: number
   *     responses:
   *       201:
   *         description: Component installation created
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
        ctx.body = { reason: errorMessage, ...metadata }
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
   *             type: object
   *             properties:
   *               componentId:
   *                 type: string
   *                 format: uuid
   *               spaceId:
   *                 type: string
   *                 format: uuid
   *               buildingPartId:
   *                 type: string
   *                 format: uuid
   *               installationDate:
   *                 type: string
   *                 format: date
   *               deinstallationDate:
   *                 type: string
   *                 format: date
   *               orderNumber:
   *                 type: string
   *               cost:
   *                 type: number
   *     responses:
   *       200:
   *         description: Component installation updated
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
        ctx.body = { reason: errorMessage, ...metadata }
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
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
