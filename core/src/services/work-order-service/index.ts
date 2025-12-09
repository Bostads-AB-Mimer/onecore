import KoaRouter from '@koa/router'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../adapters/property-management-adapter'
import * as workOrderAdapter from '../../adapters/work-order-adapter'
import * as communicationAdapter from '../../adapters/communication-adapter'
import * as schemas from './schemas'
import { registerSchema } from '../../utils/openapi'

import { ApartmentInfo, Lease, RentalPropertyInfo } from '@onecore/types'
import { logger, generateRouteMetadata } from '@onecore/utilities'

interface RentalPropertyInfoWithLeases extends RentalPropertyInfo {
  leases: Lease[]
}

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
  registerSchema('WorkOrder', schemas.CoreWorkOrderSchema)
  registerSchema('XpandWorkOrder', schemas.CoreXpandWorkOrderSchema)

  /**
   * @swagger
   * /work-orders/data/{identifier}:
   *   get:
   *     summary: Get work order data by different identifiers
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work order data along with associated leases based on the provided identifier type.
   *     parameters:
   *       - in: path
   *         name: identifier
   *         required: true
   *         schema:
   *           type: string
   *         description: The identifier value for fetching work order data.
   *       - in: query
   *         name: handler
   *         required: true
   *         schema:
   *           type: string
   *           enum: [rentalObjectId, leaseId, pnr, phoneNumber, contactCode]
   *         description: The type of the identifier used to fetch work order data.
   *     responses:
   *       '200':
   *         description: Successfully retrieved work order data.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       rentalPropertyId:
   *                         type: string
   *                       leases:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             leaseId:
   *                               type: string
   *                             rentalPropertyId:
   *                               type: string
   *                             # Add other lease properties here
   *                 # Add other metadata properties here
   *       '400':
   *         description: Invalid handler
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Invalid handler
   *       '500':
   *         description: Internal server error. Failed to retrieve work order data.
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
  router.get('/work-orders/data/:identifier', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['handler'])
    const responseData: RentalPropertyInfoWithLeases[] = []

    const getRentalPropertyInfoWithLeases = async (leases: Lease[]) => {
      for (const lease of leases) {
        const rentalPropertyInfo =
          await propertyManagementAdapter.getRentalPropertyInfo(
            lease.rentalPropertyId
          )
        if (!rentalPropertyInfo) {
          logger.error(
            `Rental property info not found for rental property id: ${lease.rentalPropertyId}`
          )
          continue
        }

        responseData.push({
          ...rentalPropertyInfo,
          leases: [lease],
        })
      }
    }

    const handlers: { [key: string]: () => Promise<void> } = {
      rentalObjectId: async () => {
        const leases = await leasingAdapter.getLeasesForPropertyId(
          ctx.params.identifier,
          {
            includeUpcomingLeases: true,
            includeTerminatedLeases: false,
            includeContacts: true,
          }
        )
        if (leases && leases.length > 0) {
          await getRentalPropertyInfoWithLeases(leases)
        } else {
          const rentalPropertyInfo =
            await propertyManagementAdapter.getRentalPropertyInfo(
              ctx.params.identifier
            )
          if (rentalPropertyInfo) {
            responseData.push({
              ...rentalPropertyInfo,
              leases: [],
            })
          }
        }
      },
      leaseId: async () => {
        const lease = await leasingAdapter.getLease(
          encodeURIComponent(ctx.params.identifier),
          'true'
        )
        if (lease) {
          await getRentalPropertyInfoWithLeases([lease])
        }
      },
      pnr: async () => {
        const leases = await leasingAdapter.getLeasesForPnr(
          ctx.params.identifier,
          {
            includeUpcomingLeases: true,
            includeTerminatedLeases: false,
            includeContacts: true,
          }
        )
        if (leases) {
          await getRentalPropertyInfoWithLeases(leases)
        }
      },
      phoneNumber: async () => {
        const contact = await leasingAdapter.getContactByPhoneNumber(
          ctx.params.identifier
        )
        if (contact) {
          const leases = await leasingAdapter.getLeasesForContactCode(
            contact.contactCode,
            {
              includeUpcomingLeases: true,
              includeTerminatedLeases: false,
              includeContacts: false,
            }
          )
          if (leases) {
            await getRentalPropertyInfoWithLeases(leases)
          }
        }
      },
      contactCode: async () => {
        const leases = await leasingAdapter.getLeasesForContactCode(
          ctx.params.identifier,
          {
            includeUpcomingLeases: true,
            includeTerminatedLeases: false,
            includeContacts: true,
          }
        )
        if (leases) {
          await getRentalPropertyInfoWithLeases(leases)
        }
      },
    }

    try {
      const handlerParam = Array.isArray(ctx.query.handler)
        ? ctx.query.handler[0]
        : ctx.query.handler
      const handler = handlers[handlerParam ?? '']

      if (handler) {
        await handler()
      } else {
        ctx.status = 400
        ctx.body = { error: 'Invalid handler', ...metadata }
        return
      }
    } catch (error) {
      logger.error(error, 'Error retrieving work order')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /work-orders/by-contact-code/{contactCode}:
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
   *         description: The contact code used to fetch work orders.
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
   *                     totalCount:
   *                       type: integer
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/WorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/work-orders/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const result = await workOrderAdapter.getWorkOrdersByContactCode(
        ctx.params.contactCode
      )
      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            totalCount: result.data.length,
            workOrders: result.data.map(
              (v): schemas.CoreWorkOrder => ({
                accessCaption: v.AccessCaption,
                caption: v.Caption,
                code: v.Code,
                contactCode: v.ContactCode,
                description: v.Description,
                detailsCaption: v.DetailsCaption,
                externalResource: v.ExternalResource,
                id: v.Id,
                lastChanged: new Date(v.LastChanged),
                priority: v.Priority,
                registered: new Date(v.Registered),
                rentalObjectCode: v.RentalObjectCode,
                status: v.Status,
                dueDate: v.DueDate ? new Date(v.DueDate) : null,
                hiddenFromMyPages: v.HiddenFromMyPages,
                workOrderRows: v.WorkOrderRows.map((row) => ({
                  description: row.Description,
                  locationCode: row.LocationCode,
                  equipmentCode: row.EquipmentCode,
                })),
                messages: v.Messages?.map((message) => ({
                  id: message.id,
                  body: message.body,
                  messageType: message.messageType,
                  author: message.author,
                  createDate: new Date(message.createDate),
                })),
              })
            ),
          },
          ...metadata,
        }
      } else {
        logger.error(
          { error: result.err, metadata },
          'Error getting workOrders by contact code'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error getting workOrders by contact code')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /work-orders/by-rental-property-id/{rentalPropertyId}:
   *   get:
   *     summary: Get work orders by rental property id
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders based on the provided rental property id.
   *     parameters:
   *       - in: path
   *         name: rentalPropertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental property id used to fetch work orders.
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
   *                     totalCount:
   *                       type: integer
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/WorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/work-orders/by-rental-property-id/:rentalPropertyId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const result = await workOrderAdapter.getWorkOrdersByRentalPropertyId(
          ctx.params.rentalPropertyId
        )

        if (result.ok) {
          ctx.status = 200
          ctx.body = {
            content: {
              totalCount: result.data.length,
              workOrders: result.data.map(
                (v): schemas.CoreWorkOrder => ({
                  accessCaption: v.AccessCaption,
                  caption: v.Caption,
                  code: v.Code,
                  dueDate: v.DueDate ? new Date(v.DueDate) : null,
                  contactCode: v.ContactCode,
                  description: v.Description,
                  detailsCaption: v.DetailsCaption,
                  externalResource: v.ExternalResource,
                  id: v.Id,
                  lastChanged: new Date(v.LastChanged),
                  priority: v.Priority,
                  registered: new Date(v.Registered),
                  rentalObjectCode: v.RentalObjectCode,
                  status: v.Status,
                  url: v.Url,
                  workOrderRows: v.WorkOrderRows.map((row) => ({
                    description: row.Description,
                    locationCode: row.LocationCode,
                    equipmentCode: row.EquipmentCode,
                  })),
                })
              ),
            },
            ...metadata,
          }
        } else {
          logger.error(
            {
              err: result.err,
              metadata,
            },
            'Error getting workOrders by rental property id'
          )
          ctx.status = result.statusCode || 500
          ctx.body = { error: result.err, ...metadata }
        }
      } catch (error) {
        logger.error(error, 'Error getting workOrders by rental property id')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
    }
  )

  /**
   * @swagger
   * /work-orders/by-property-id/{propertyId}:
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
   *         description: The property id used to fetch work orders.
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
   *                     totalCount:
   *                       type: integer
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/WorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/work-orders/by-property-id/:propertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const result = await workOrderAdapter.getWorkOrdersByPropertyId(
        ctx.params.propertyId
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            totalCount: result.data.length,
            workOrders: result.data.map(
              (v): schemas.CoreWorkOrder => ({
                accessCaption: v.AccessCaption,
                caption: v.Caption,
                code: v.Code,
                dueDate: v.DueDate ? new Date(v.DueDate) : null,
                contactCode: v.ContactCode,
                description: v.Description,
                detailsCaption: v.DetailsCaption,
                externalResource: v.ExternalResource,
                id: v.Id,
                lastChanged: new Date(v.LastChanged),
                priority: v.Priority,
                registered: new Date(v.Registered),
                rentalObjectCode: v.RentalObjectCode,
                status: v.Status,
                url: v.Url,
                workOrderRows: v.WorkOrderRows.map((row) => ({
                  description: row.Description,
                  locationCode: row.LocationCode,
                  equipmentCode: row.EquipmentCode,
                })),
              })
            ),
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting workOrders by property id'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error getting workOrders by property id')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /work-orders/by-building-id/{buildingId}:
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
   *         description: The building id used to fetch work orders.
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
   *                     totalCount:
   *                       type: integer
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/WorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/work-orders/by-building-id/:buildingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const result = await workOrderAdapter.getWorkOrdersByBuildingId(
        ctx.params.buildingId
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            totalCount: result.data.length,
            workOrders: result.data.map(
              (v): schemas.CoreWorkOrder => ({
                accessCaption: v.AccessCaption,
                caption: v.Caption,
                code: v.Code,
                dueDate: v.DueDate ? new Date(v.DueDate) : null,
                contactCode: v.ContactCode,
                description: v.Description,
                detailsCaption: v.DetailsCaption,
                externalResource: v.ExternalResource,
                id: v.Id,
                lastChanged: new Date(v.LastChanged),
                priority: v.Priority,
                registered: new Date(v.Registered),
                rentalObjectCode: v.RentalObjectCode,
                status: v.Status,
                url: v.Url,
                workOrderRows: v.WorkOrderRows.map((row) => ({
                  description: row.Description,
                  locationCode: row.LocationCode,
                  equipmentCode: row.EquipmentCode,
                })),
              })
            ),
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting workOrders by building id'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error getting workOrders by building id')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /work-orders/xpand/by-contact-code/{contactCode}:
   *   get:
   *     summary: Get work orders by contact code from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders from xpand based on the provided contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code used to fetch work orders.
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
   *                     totalCount:
   *                       type: integer
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/XpandWorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/work-orders/xpand/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedParams = schemas.GetWorkOrdersFromXpandQuerySchema.safeParse(
      ctx.query
    )
    if (!parsedParams.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        ...metadata,
      }
      return
    }

    const { skip, limit, sortAscending } = parsedParams.data

    try {
      const result = await workOrderAdapter.getXpandWorkOrdersByContactCode(
        ctx.params.contactCode,
        { skip, limit, sortAscending }
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            totalCount: result.data.length,
            workOrders: result.data.map(
              (v): schemas.CoreXpandWorkOrder => ({
                accessCaption: v.AccessCaption,
                caption: v.Caption,
                code: v.Code,
                contactCode: v.ContactCode,
                id: v.Id,
                lastChanged: new Date(v.LastChanged),
                priority: v.Priority,
                dueDate: v.DueDate ? new Date(v.DueDate) : null,
                registered: new Date(v.Registered),
                rentalObjectCode: v.RentalObjectCode,
                status: v.Status,
              })
            ),
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting workOrders by contact code from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error getting workOrders by contact code from xpand')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /work-orders/xpand/by-rental-property-id/{rentalPropertyId}:
   *   get:
   *     summary: Get work orders by rental property id from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders based on the provided rental property id.
   *     parameters:
   *       - in: path
   *         name: rentalPropertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental property id used to fetch work orders.
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
   *                     totalCount:
   *                       type: integer
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/XpandWorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/work-orders/xpand/by-rental-property-id/:rentalPropertyId',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const parsedParams = schemas.GetWorkOrdersFromXpandQuerySchema.safeParse(
        ctx.query
      )
      if (!parsedParams.success) {
        ctx.status = 400
        ctx.body = {
          error: 'Invalid query parameters',
          ...metadata,
        }
        return
      }

      const { skip, limit, sortAscending } = parsedParams.data

      try {
        const result =
          await workOrderAdapter.getXpandWorkOrdersByRentalPropertyId(
            ctx.params.rentalPropertyId,
            { skip, limit, sortAscending }
          )

        if (result.ok) {
          ctx.status = 200
          ctx.body = {
            content: {
              totalCount: result.data.length,
              workOrders: result.data.map(
                (v): schemas.CoreXpandWorkOrder => ({
                  accessCaption: v.AccessCaption,
                  caption: v.Caption,
                  code: v.Code,
                  contactCode: v.ContactCode,
                  id: v.Id,
                  lastChanged: new Date(v.LastChanged),
                  priority: v.Priority,
                  dueDate: v.DueDate ? new Date(v.DueDate) : null,
                  registered: new Date(v.Registered),
                  rentalObjectCode: v.RentalObjectCode,
                  status: v.Status,
                })
              ),
            },
            ...metadata,
          }
        } else {
          logger.error(
            {
              err: result.err,
              metadata,
            },
            'Error getting workOrders by rental property id from xpand'
          )
          ctx.status = result.statusCode || 500
          ctx.body = { error: result.err, ...metadata }
        }
      } catch (error) {
        logger.error(
          error,
          'Error getting workOrders by rental property id from xpand'
        )
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
    }
  )

  /**
   * @swagger
   * /work-orders/xpand/by-property-id/{propertyId}:
   *   get:
   *     summary: Get work orders by property id from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders based on the provided property id.
   *     parameters:
   *       - in: path
   *         name: propertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The property id used to fetch work orders.
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
   *                     totalCount:
   *                       type: integer
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/XpandWorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/work-orders/xpand/by-property-id/:propertyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedParams = schemas.GetWorkOrdersFromXpandQuerySchema.safeParse(
      ctx.query
    )
    if (!parsedParams.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        ...metadata,
      }
      return
    }

    const { skip, limit, sortAscending } = parsedParams.data

    try {
      const result = await workOrderAdapter.getXpandWorkOrdersByPropertyId(
        ctx.params.propertyId,
        { skip, limit, sortAscending }
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            totalCount: result.data.length,
            workOrders: result.data.map(
              (v): schemas.CoreXpandWorkOrder => ({
                accessCaption: v.AccessCaption,
                caption: v.Caption,
                code: v.Code,
                contactCode: v.ContactCode,
                id: v.Id,
                lastChanged: new Date(v.LastChanged),
                priority: v.Priority,
                dueDate: v.DueDate ? new Date(v.DueDate) : null,
                registered: new Date(v.Registered),
                rentalObjectCode: v.RentalObjectCode,
                status: v.Status,
              })
            ),
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting workOrders by property id from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error getting workOrders by property id from xpand')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /work-orders/xpand/by-building-id/{buildingId}:
   *   get:
   *     summary: Get work orders by building id from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work orders based on the provided building id.
   *     parameters:
   *       - in: path
   *         name: buildingId
   *         required: true
   *         schema:
   *           type: string
   *         description: The building id used to fetch work orders.
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
   *                     totalCount:
   *                       type: integer
   *                     workOrders:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/XpandWorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/work-orders/xpand/by-building-id/:buildingId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const parsedParams = schemas.GetWorkOrdersFromXpandQuerySchema.safeParse(
      ctx.query
    )
    if (!parsedParams.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        ...metadata,
      }
      return
    }

    const { skip, limit, sortAscending } = parsedParams.data

    try {
      const result = await workOrderAdapter.getXpandWorkOrdersByBuildingId(
        ctx.params.buildingId,
        { skip, limit, sortAscending }
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            totalCount: result.data.length,
            workOrders: result.data.map(
              (v): schemas.CoreXpandWorkOrder => ({
                accessCaption: v.AccessCaption,
                caption: v.Caption,
                code: v.Code,
                contactCode: v.ContactCode,
                id: v.Id,
                lastChanged: new Date(v.LastChanged),
                priority: v.Priority,
                dueDate: v.DueDate ? new Date(v.DueDate) : null,
                registered: new Date(v.Registered),
                rentalObjectCode: v.RentalObjectCode,
                status: v.Status,
              })
            ),
          },
          ...metadata,
        }
      } else {
        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting workOrders by building id from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(error, 'Error getting workOrders by building id from xpand')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /work-orders/xpand/{code}:
   *   get:
   *     summary: Get work order details by rental property id from xpand
   *     tags:
   *       - Work Order Service
   *     description: Retrieves work order details.
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
   *                   $ref: '#/components/schemas/XpandWorkOrder'
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
   *     security:
   *       - bearerAuth: []
   */
  router.get('/work-orders/xpand/:code', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const result = await workOrderAdapter.getXpandWorkOrderDetails(
        ctx.params.code
      )
      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          content: {
            id: result.data.Id,
            accessCaption: result.data.AccessCaption,
            caption: result.data.Caption,
            code: result.data.Code,
            contactCode: result.data.ContactCode,
            lastChanged: new Date(result.data.LastChanged),
            priority: result.data.Priority,
            registered: new Date(result.data.Registered),
            dueDate: result.data.DueDate ? new Date(result.data.DueDate) : null,
            rentalObjectCode: result.data.RentalObjectCode,
            status: result.data.Status,
            workOrderRows: result.data.WorkOrderRows.map((row) => ({
              description: row.Description,
              locationCode: row.LocationCode,
              equipmentCode: row.EquipmentCode,
            })),
            description: result.data.Description,
          } satisfies schemas.CoreXpandWorkOrderDetails,
          ...metadata,
        }
      } else {
        if (result.err === 'not-found') {
          ctx.status = 404
          ctx.body = { error: 'Work order not found', ...metadata }
          return
        }

        logger.error(
          {
            err: result.err,
            metadata,
          },
          'Error getting workOrders by rental property id from xpand'
        )
        ctx.status = result.statusCode || 500
        ctx.body = { error: result.err, ...metadata }
      }
    } catch (error) {
      logger.error(
        error,
        'Error getting workOrders by rental property id from xpand'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /work-orders:
   *   post:
   *     summary: Create a new work order
   *     tags:
   *       - Work Order Service
   *     description: Creates a new work order.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               ContactCode:
   *                 type: string
   *                 description: The contact code of the tenant.
   *               RentalObjectCode:
   *                 type: string
   *                 description: The rental property ID.
   *               Rows:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     LocationCode:
   *                       type: string
   *                       description: The location code of the work order.
   *                     # Add other work order properties here
   *               AccessOptions:
   *                 type: object
   *                 description: Access options for the work order.
   *               Pet:
   *                 type: object
   *                 description: Pet information for the work order.
   *               Images:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: uri
   *                   description: URLs of images related to the work order.
   *     responses:
   *       '200':
   *         description: Successfully created the work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Work order created
   *       '400':
   *         description: Bad request. Missing or invalid parameters.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: ContactCode is missing
   *       '404':
   *         description: Not found. Rental property or active lease not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Rental property not found
   *       '500':
   *         description: Internal server error. Failed to create the work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: Failed to create a new work order
   *     security:
   *       - bearerAuth: []
   */
  router.post('/work-orders', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const {
        ContactCode,
        RentalObjectCode,
        Rows,
        AccessOptions,
        HearingImpaired,
        Pet,
        Images,
      } = ctx.request.body

      const reason = !ContactCode
        ? 'ContactCode is missing'
        : !RentalObjectCode
          ? 'RentalObjectCode is missing'
          : Rows.length === 0
            ? 'No work orders found in request'
            : null

      if (reason) {
        ctx.status = 400
        ctx.body = {
          reason,
          ...metadata,
        }
        return
      }

      // Get rental property info
      const rentalPropertyInfo =
        await propertyManagementAdapter.getRentalPropertyInfo(RentalObjectCode)
      if (!rentalPropertyInfo) {
        ctx.status = 404
        ctx.body = {
          reason: 'Rental property not found',
          ...metadata,
        }
        return
      }

      /*
        We know that rentalPropertyInfo.property is of type ApartmentInfo here,
        but that is not reflected in the RentalPropertyInfo type, so we do a little narrowing
      */
      const rentalPropertyIsApartment = (
        rentalPropertyInfo: RentalPropertyInfo
      ): rentalPropertyInfo is RentalPropertyInfo & {
        property: ApartmentInfo
      } => rentalPropertyInfo.type === 'Lägenhet'

      if (!rentalPropertyIsApartment(rentalPropertyInfo)) {
        ctx.status = 400
        ctx.body = {
          reason: 'Rental property is not an apartment',
          ...metadata,
        }
        return
      }

      // Get tenant with leases by contact code
      const tenant = await leasingAdapter.getTenantByContactCode(ContactCode)
      if (!tenant.ok) {
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      // Find active lease that matches rental property id
      const lease = tenant.data.housingContracts.find(
        (lease: Lease) =>
          (!lease.leaseEndDate || new Date(lease.leaseEndDate) > new Date()) &&
          lease.rentalPropertyId === RentalObjectCode
      )

      if (!lease) {
        ctx.status = 404
        ctx.body = {
          reason: 'Cannot find active lease for rental property',
          ...metadata,
        }
        return
      }

      const result = await workOrderAdapter.createWorkOrder({
        rentalProperty: rentalPropertyInfo,
        // @ts-expect-error phoneNumbers.isMainNumber is typed as boolean, but it is actually a number
        tenant: tenant.data,
        // @ts-expect-error leaseStartDate and other dates are typed as Date, but they are actually strings
        lease,
        details: {
          ContactCode,
          RentalObjectCode,
          AccessOptions,
          HearingImpaired,
          Pet,
          Images,
          Rows,
        },
      })

      if (!result.ok) {
        throw result.err
      }

      ctx.status = 200
      ctx.body = {
        message: `Work orders created`,
        // TODO better handling/response when there is an error with creating one or more work orders in the batch
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Error creating new work orders')
      ctx.status = 500
      ctx.body = {
        error: 'Failed to create new work orders',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /work-orders/{workOrderId}/update:
   *   post:
   *     summary: Update a work order with a message
   *     tags:
   *       - Work Order Service
   *     description: Adds a message to the specified work order.
   *     parameters:
   *       - in: path
   *         name: workOrderId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the work order to be updated.
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
   *     responses:
   *       '200':
   *         description: Successfully added the message to the work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Message added to work order with ID {workOrderId}
   *       '400':
   *         description: Bad request. Missing or invalid parameters.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: Message is missing from the request body
   *       '500':
   *         description: Internal server error. Failed to add the message to the work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Failed to add message to work order with ID {workOrderId}
   *     security:
   *       - bearerAuth: []
   */
  router.post('/work-orders/:workOrderId/update', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { workOrderId } = ctx.params
    const { message } = ctx.request.body

    if (!message) {
      ctx.status = 400
      ctx.body = {
        reason: 'Message is missing from the request body',
        ...metadata,
      }
      return
    }

    try {
      await workOrderAdapter.updateWorkOrder(workOrderId, message)

      ctx.status = 200
      ctx.body = {
        message: `Message added to work order with ID ${workOrderId}`,
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Error adding message to work order')

      ctx.status = 500
      ctx.body = {
        message: `Failed to add message to work order with ID ${workOrderId}`,
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /work-orders/{workOrderId}/close:
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
   *         description: Successfully closed the work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Work order with ID {workOrderId} updated successfully
   *       '500':
   *         description: Internal server error. Failed to close the work order.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Failed to update work order with ID {workOrderId}
   *     security:
   *       - bearerAuth: []
   */
  router.post('/work-orders/:workOrderId/close', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { workOrderId } = ctx.params

    const success = await workOrderAdapter.closeWorkOrder(workOrderId)

    if (success) {
      ctx.status = 200
      ctx.body = {
        message: `Work order with ID ${workOrderId} updated successfully`,
        ...metadata,
      }
    } else {
      ctx.status = 500
      ctx.body = {
        message: `Failed to update work order with ID ${workOrderId}`,
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /work-orders/send-sms:
   *   post:
   *     summary: Send SMS for a work order
   *     tags:
   *       - Work Order Service
   *     description: Sends an SMS message to the specified phone number for a work order.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               phoneNumber:
   *                 type: string
   *                 description: The phone number to send the SMS to.
   *               text:
   *                 type: string
   *                 description: The message to be sent via SMS.
   *     responses:
   *       '200':
   *         description: Successfully sent the SMS.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Sms sent to {phoneNumber}"
   *       '400':
   *         description: Bad request. Missing or invalid parameters.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: "Bad request: phoneNumber and message are required"
   *       '500':
   *         description: Internal server error. Failed to send the SMS.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Unexpected error sending sms to {phoneNumber}"
   *     security:
   *       - bearerAuth: []
   */
  router.post('/work-orders/send-sms', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { phoneNumber, text, externalContractorName } = ctx.request.body

    if (!phoneNumber || !text) {
      ctx.status = 400
      ctx.body = {
        reason: 'Bad request: phoneNumber and text are required',
        ...metadata,
      }
      return
    }

    try {
      const result = await communicationAdapter.sendWorkOrderSms({
        phoneNumber,
        text,
        externalContractorName,
      })

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          message: `Sms sent to ${phoneNumber}`,
          ...metadata,
        }
      } else {
        logger.error(
          { error: result.err },
          `Error sending sms to ${phoneNumber}, status: ${result.statusCode}`
        )
        ctx.status = result.statusCode ?? 500
        ctx.body = {
          message: `Failed to send sms to ${phoneNumber}, status: ${result.statusCode}`,
          ...metadata,
        }
      }
    } catch (error) {
      logger.error(error, `Unexpected error sending sms to ${phoneNumber}`)
      ctx.status = 500
      ctx.body = {
        message: `Unexpected error sending sms to ${phoneNumber}`,
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /work-orders/send-email:
   *   post:
   *     summary: Send email for a work order
   *     tags:
   *       - Work Order Service
   *     description: Sends an email to the specified recipient for a work order.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               to:
   *                 type: string
   *                 description: The email address of the recipient.
   *               subject:
   *                 type: string
   *                 description: The subject of the email.
   *               message:
   *                 type: string
   *                 description: The message to be sent in the email.
   *     responses:
   *       '200':
   *         description: Successfully sent the email.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Email sent to {to}"
   *       '400':
   *         description: Bad request. Missing or invalid parameters.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: "Bad request: to, subject, and message are required"
   *       '500':
   *         description: Internal server error. Failed to send the email.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 text:
   *                   type: string
   *                   example: "Failed to send email to {to}, status: {statusCode}"
   *     security:
   *       - bearerAuth: []
   */
  router.post('/work-orders/send-email', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { to, subject, text, externalContractorName } = ctx.request.body

    if (to === undefined || subject === undefined || text === undefined) {
      ctx.status = 400
      ctx.body = {
        reason: 'Bad request',
        ...metadata,
      }

      return
    }

    const result = await communicationAdapter.sendWorkOrderEmail({
      to,
      subject,
      text,
      externalContractorName,
    })

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        message: `Email sent to ${to}`,
        ...metadata,
      }
    } else {
      logger.error(
        { error: result.err },
        `Error sending email to ${to}, status: ${result.statusCode}`
      )

      ctx.status = result.statusCode ?? 500
      ctx.body = {
        message: `Failed to send email to ${to}, status: ${result.statusCode}`,
        ...metadata,
      }
    }
  })
}
