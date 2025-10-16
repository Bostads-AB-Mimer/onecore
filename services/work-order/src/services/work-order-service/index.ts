import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import * as odooAdapter from './adapters/odoo-adapter'
import {
  CreateWorkOrderBodySchema,
  CreateWorkOrderDetailsSchema,
  GetWorkOrdersFromXpandQuerySchema,
  LeaseSchema,
  RentalPropertySchema,
  TenantSchema,
  WorkOrder,
  WorkOrderSchema,
  XpandWorkOrderDetails,
  XpandWorkOrderDetailsSchema,
  XpandWorkOrderSchema,
} from './schemas'
import * as xpandAdapter from './adapters/xpand-adapter'
import { registerSchema } from '../../middlewares/swagger-middleware'

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Work Order Service
 *     description: Operations related to work orders
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */
export const routes = (router: KoaRouter) => {
  registerSchema('WorkOrder', WorkOrderSchema)
  registerSchema('XpandWorkOrder', XpandWorkOrderSchema)
  registerSchema('XpandWorkOrderDetails', XpandWorkOrderDetailsSchema)
  registerSchema('CreateWorkOrderBody', CreateWorkOrderBodySchema)
  registerSchema('CreateWorkOrderDetails', CreateWorkOrderDetailsSchema)
  registerSchema('Lease', LeaseSchema)
  registerSchema('Tenant', TenantSchema)
  registerSchema('RentalProperty', RentalPropertySchema)

  /**
   * @swagger
   * /workOrders/contactCode/{contactCode}:
   *   get:
   *     summary: Get work orders by contact code
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders based on the provided contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code to filter work orders.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/WorkOrder'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to retrieve work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/workOrders/contactCode/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const workOrders = await odooAdapter.getWorkOrdersByContactCode(
        ctx.params.contactCode
      )

      ctx.status = 200
      ctx.body = {
        content: {
          workOrders: workOrders satisfies WorkOrder[],
        },
        ...metadata,
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/residenceId/{residenceId}:
   *   get:
   *     summary: Get work orders by residence id
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders based on the provided residence id.
   *     parameters:
   *       - in: path
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The residence id to filter work orders.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/WorkOrder'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to retrieve work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/workOrders/residenceId/:residenceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const workOrders = await odooAdapter.getWorkOrdersByResidenceId(
        ctx.params.residenceId
      )
      ctx.status = 200
      ctx.body = {
        content: {
          workOrders: workOrders satisfies WorkOrder[],
        },
        ...metadata,
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/propertyId/{propertyId}:
   *   get:
   *     summary: Get work orders by property id
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders based on the provided property id.
   *     parameters:
   *       - in: path
   *         name: propertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The property id to filter work orders.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/WorkOrder'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to retrieve work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/workOrders/propertyId/:propertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const workOrders = await odooAdapter.getWorkOrdersByPropertyId(
        ctx.params.propertyId
      )
      ctx.status = 200
      ctx.body = {
        content: {
          workOrders: workOrders satisfies WorkOrder[],
        },
        ...metadata,
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/buildingId/{buildingId}:
   *   get:
   *     summary: Get work orders by building id
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders based on the provided building id.
   *     parameters:
   *       - in: path
   *         name: buildingId
   *         required: true
   *         schema:
   *           type: string
   *         description: The building id to filter work orders.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/WorkOrder'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to retrieve work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/workOrders/buildingId/:buildingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const workOrders = await odooAdapter.getWorkOrdersByBuildingId(
        ctx.params.buildingId
      )
      ctx.status = 200
      ctx.body = {
        content: {
          workOrders: workOrders satisfies WorkOrder[],
        },
        ...metadata,
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/xpand/residenceId/{residenceId}:
   *   get:
   *     summary: Get work orders by residence id from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders from xpand based on the provided residence id.
   *     parameters:
   *       - in: path
   *         name: residenceId
   *         required: true
   *         schema:
   *           type: string
   *         description: The residence id to filter work orders.
   *       - in: query
   *         name: skip
   *         required: false
   *         schema:
   *           type: number
   *         description: The number of work orders to skip.
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: number
   *         description: The number of work orders to fetch.
   *       - in: query
   *         name: sortAscending
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Whether to sort the work orders by ascending creation date.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/XpandWorkOrder'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to retrieve work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/workOrders/xpand/residenceId/:residenceId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedQuery = GetWorkOrdersFromXpandQuerySchema.safeParse(ctx.query)
    if (!parsedQuery.success) {
      ctx.status = 400
      ctx.body = {
        error: parsedQuery.error,
        ...metadata,
      }
      return
    }

    const { skip, limit, sortAscending } = parsedQuery.data

    try {
      const xpandWorkOrders = await xpandAdapter.getWorkOrdersByResidenceId(
        ctx.params.residenceId,
        {
          skip,
          limit,
          sortAscending,
        }
      )

      if (!xpandWorkOrders.ok) {
        ctx.status = 500
        ctx.body = {
          error: `Failed to fetch work orders from Xpand: ${xpandWorkOrders.err}`,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: {
          workOrders: xpandWorkOrders.data,
        },
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Error fetching work orders from Xpand')
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/xpand/propertyId/{propertyId}:
   *   get:
   *     summary: Get work orders by property id from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders from xpand based on the provided property id.
   *     parameters:
   *       - in: path
   *         name: propertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The property id to filter work orders.
   *       - in: query
   *         name: skip
   *         required: false
   *         schema:
   *           type: number
   *         description: The number of work orders to skip.
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: number
   *         description: The number of work orders to fetch.
   *       - in: query
   *         name: sortAscending
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Whether to sort the work orders by ascending creation date.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/XpandWorkOrder'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to retrieve work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/workOrders/xpand/propertyId/:propertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedQuery = GetWorkOrdersFromXpandQuerySchema.safeParse(ctx.query)
    if (!parsedQuery.success) {
      ctx.status = 400
      ctx.body = {
        error: parsedQuery.error,
        ...metadata,
      }
      return
    }

    const { skip, limit, sortAscending } = parsedQuery.data

    try {
      const xpandWorkOrders = await xpandAdapter.getWorkOrdersByPropertyId(
        ctx.params.propertyId,
        {
          skip,
          limit,
          sortAscending,
        }
      )

      if (!xpandWorkOrders.ok) {
        ctx.status = 500
        ctx.body = {
          error: `Failed to fetch work orders from Xpand: ${xpandWorkOrders.err}`,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: {
          workOrders: xpandWorkOrders.data,
        },
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Error fetching work orders from Xpand')
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/xpand/buildingId/{buildingId}:
   *   get:
   *     summary: Get work orders by building id from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders from xpand based on the provided building id.
   *     parameters:
   *       - in: path
   *         name: buildingId
   *         required: true
   *         schema:
   *           type: string
   *         description: The building id to filter work orders.
   *       - in: query
   *         name: skip
   *         required: false
   *         schema:
   *           type: number
   *         description: The number of work orders to skip.
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: number
   *         description: The number of work orders to fetch.
   *       - in: query
   *         name: sortAscending
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Whether to sort the work orders by ascending creation date.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/XpandWorkOrder'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to retrieve work orders.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/workOrders/xpand/buildingId/:buildingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedQuery = GetWorkOrdersFromXpandQuerySchema.safeParse(ctx.query)
    if (!parsedQuery.success) {
      ctx.status = 400
      ctx.body = {
        error: parsedQuery.error,
        ...metadata,
      }
      return
    }

    const { skip, limit, sortAscending } = parsedQuery.data

    try {
      const xpandWorkOrders = await xpandAdapter.getWorkOrdersByBuildingId(
        ctx.params.buildingId,
        {
          skip,
          limit,
          sortAscending,
        }
      )

      if (!xpandWorkOrders.ok) {
        ctx.status = 500
        ctx.body = {
          error: `Failed to fetch work orders from Xpand: ${xpandWorkOrders.err}`,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: {
          workOrders: xpandWorkOrders.data,
        },
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Error fetching work orders from Xpand')
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/xpand/{code}:
   *   get:
   *     summary: Get work order details by work order code from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work order details from xpand.
   *     parameters:
   *       - in: path
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: The work order code to fetch details for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/XpandWorkOrderDetails'
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '404':
   *         description: Work order not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Work order not found
   *       '500':
   *         description: Internal server error. Failed to retrieve work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/workOrders/xpand/:code', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const xpandWorkOrder = await xpandAdapter.getWorkOrderDetails(
        ctx.params.code
      )

      if (!xpandWorkOrder.ok) {
        if (xpandWorkOrder.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: `Work order with code ${ctx.params.code} not found`,
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: `Failed to fetch work order from Xpand: ${xpandWorkOrder.err}`,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: xpandWorkOrder.data satisfies XpandWorkOrderDetails,
        ...metadata,
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders:
   *   post:
   *     summary: Create a new work order
   *     tags:
   *       - Work Order Service
   *     description: Creates a new work order based on the provided request body.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             $ref: '#/components/schemas/CreateWorkOrderBody'
   *     responses:
   *       '200':
   *         description: Work order created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     newWorkOrderId:
   *                       type: number
   *                       example: 123
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '400':
   *         description: Bad request. Failed to create work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Error message from the adapter
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to create work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/workOrders', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const parsedBody = CreateWorkOrderBodySchema.safeParse(ctx.request.body)
      if (!parsedBody.success) {
        ctx.status = 400
        ctx.body = {
          error: parsedBody.error,
          ...metadata,
        }
        return
      }
      const { rentalProperty, tenant, lease, details } = parsedBody.data

      const response = await odooAdapter.createWorkOrder(
        rentalProperty,
        tenant,
        lease,
        details
      )
      ctx.status = 200
      if (response.ok) {
        ctx.body = {
          content: { newWorkOrderId: response.data },
          ...metadata,
        }
      } else {
        ctx.status = 400
        ctx.body = {
          error: response.err,
          ...metadata,
        }
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/{workOrderId}/update:
   *   post:
   *     summary: Add a message to a work order
   *     tags:
   *       - Work Order Service
   *     description: Adds a message to a work order based on the provided work order ID.
   *     parameters:
   *       - in: path
   *         name: workOrderId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the work order to which the message will be added.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               message:
   *                 type: string
   *                 description: The message to be added to the work order.
   *                 example: "This is a new message for the work order."
   *     responses:
   *       '200':
   *         description: Message added to the work order successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: Message added to work order with ID {workOrderId}
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '400':
   *         description: Bad request. Message is missing from the request body.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Message is missing from the request body
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to add message to the work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Internal server error
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/workOrders/:workOrderId/update', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { workOrderId } = ctx.params
    const { message } = ctx.request.body as any

    if (!message) {
      ctx.status = 400
      ctx.body = {
        reason: 'Message is missing from the request body',
        ...metadata,
      }
      return
    }

    try {
      await odooAdapter.addMessageToWorkOrder(parseInt(workOrderId), message)

      ctx.status = 200
      ctx.body = {
        message: `Message added to work order with ID ${workOrderId}`,
        ...metadata,
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })

  /**
   * @swagger
   * /workOrders/{workOrderId}/close:
   *   post:
   *     summary: Close a work order
   *     tags:
   *       - Work Order Service
   *     description: Closes a work order based on the provided work order ID.
   *     parameters:
   *       - in: path
   *         name: workOrderId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the work order to be closed.
   *     responses:
   *       '200':
   *         description: Work order closed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: Work order with ID {workOrderId} updated successfully
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *       '500':
   *         description: Internal server error. Failed to close work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Failed to update work order with ID {workOrderId}
   *                 metadata:
   *                   type: object
   *                   description: Route metadata
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/workOrders/:workOrderId/close', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const { workOrderId } = ctx.params

      await odooAdapter.closeWorkOrder(parseInt(workOrderId, 10))

      ctx.status = 200
      ctx.body = {
        message: `Work order with ID ${workOrderId} updated successfully`,
        ...metadata,
      }
    } catch (error: unknown) {
      ctx.status = 500

      if (error instanceof Error) {
        ctx.body = {
          error: error.message,
          ...metadata,
        }
      }
    }
  })
}
