import KoaRouter from '@koa/router'

import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../adapters/property-management-adapter'
import * as workOrderAdapter from '../../adapters/work-order-adapter'
import * as communicationAdapter from '../../adapters/communication-adapter'

import { Lease, RentalPropertyInfo } from 'onecore-types'
import { logger, generateRouteMetadata } from 'onecore-utilities'

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
  /**
   * @swagger
   * /workOrderData/{identifier}:
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
  router.get('(.*)/workOrderData/:identifier', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['handler'])
    const responseData: any = []

    const getRentalPropertyInfoWithLeases = async (leases: Lease[]) => {
      for (const lease of leases) {
        const rentalPropertyInfo =
          await propertyManagementAdapter.getRentalPropertyInfo(
            lease.rentalPropertyId
          )

        responseData.push({
          ...rentalPropertyInfo,
          leases: [lease],
        } as RentalPropertyInfoWithLeases)
      }
    }

    const handlers: { [key: string]: () => Promise<void> } = {
      rentalObjectId: async () => {
        const leases = await leasingAdapter.getLeasesForPropertyId(
          ctx.params.identifier,
          ctx.query['includeTerminatedLeases'],
          'true'
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
            } as RentalPropertyInfoWithLeases)
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
          false,
          true
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
          const leases = await leasingAdapter.getLeasesForPnr(
            contact.nationalRegistrationNumber,
            false,
            true
          )
          if (leases) {
            await getRentalPropertyInfoWithLeases(leases)
          }
        }
      },
      contactCode: async () => {
        const contactResult = await leasingAdapter.getContactByContactCode(
          ctx.params.identifier
        )
        if (contactResult.ok) {
          const leases = await leasingAdapter.getLeasesForPnr(
            contactResult.data.nationalRegistrationNumber,
            false,
            true
          )
          if (leases) {
            await getRentalPropertyInfoWithLeases(leases)
          }
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
   *                         type: object
   *                         properties:
   *                           # Add work order properties here
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
  router.get('(.*)/workOrders/contactCode/:contactCode', async (ctx) => {
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
            workOrders: result.data,
          },
          ...metadata,
        }
      } else {
        logger.error(
          result.err,
          'Error getting workOrders by contact code',
          metadata
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
   * /workOrders:
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
  router.post('(.*)/workOrders', async (ctx) => {
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

      // Filter out workOrders that are not related to laundry rooms
      const laundryRoomWorkOrderRequests = Rows.filter(
        (workOrder: any) => workOrder.LocationCode === 'TV'
      )

      const reason = !ContactCode
        ? 'ContactCode is missing'
        : !RentalObjectCode
          ? 'RentalObjectCode is missing'
          : laundryRoomWorkOrderRequests.length === 0
            ? 'No work orders on laundry rooms found in request'
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

      // Check if rental property has laundry room access
      const propertyHasLaundryRoomAccess =
        rentalPropertyInfo.maintenanceUnits?.find(
          (unit) => unit.type.toUpperCase() === 'TVÄTTSTUGA'
        )
      if (!propertyHasLaundryRoomAccess) {
        ctx.status = 404
        ctx.body = {
          reason: 'No laundry room found for rental property',
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

      for (let workOrderRequest of laundryRoomWorkOrderRequests) {
        workOrderRequest = {
          rentalPropertyInfo: rentalPropertyInfo,
          tenant: tenant.data,
          lease: lease,
          details: {
            ContactCode,
            RentalObjectCode,
            AccessOptions,
            HearingImpaired,
            Pet,
            Images,
            Rows: [workOrderRequest],
          },
        }
        workOrderAdapter.createWorkOrder(workOrderRequest)
      }

      ctx.status = 200
      ctx.body = {
        message: `Work order created`,
        ...metadata,
      }
    } catch (error) {
      logger.error(error, 'Error creating new work order')
      ctx.status = 500
      ctx.body = {
        error: 'Failed to create a new work order',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /workOrders/{workOrderId}/update:
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
   *           type: integer
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
  router.post('(.*)/workOrders/:workOrderId/update', async (ctx) => {
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
      await workOrderAdapter.updateWorkOrder(parseInt(workOrderId), message)

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
   *           type: integer
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
  router.post('(.*)/workOrders/:workOrderId/close', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { workOrderId } = ctx.params

    const success = await workOrderAdapter.closeWorkOrder(parseInt(workOrderId))

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
   * /workOrders/sendSms:
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
   *               message:
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
  router.post('(.*)/workOrders/sendSms', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { phoneNumber, message } = ctx.request.body

    if (!phoneNumber || !message) {
      ctx.status = 400
      ctx.body = {
        reason: 'Bad request: phoneNumber and message are required',
        ...metadata,
      }
      return
    }

    try {
      const result = await communicationAdapter.sendWorkOrderSms(
        phoneNumber,
        message
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = {
          message: `Sms sent to ${phoneNumber}`,
          ...metadata,
        }
      } else {
        logger.error(
          result.err,
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
   * /workOrders/sendEmail:
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
   *                 message:
   *                   type: string
   *                   example: "Failed to send email to {to}, status: {statusCode}"
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/workOrders/sendEmail', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { to, subject, message } = ctx.request.body

    if (to === undefined || subject === undefined || message === undefined) {
      ctx.status = 400
      ctx.body = {
        reason: 'Bad request',
        ...metadata,
      }

      return
    }

    const result = await communicationAdapter.sendWorkOrderEmail(
      to,
      subject,
      message
    )

    if (result.ok) {
      ctx.status = 200
      ctx.body = {
        message: `Email sent to ${to}`,
        ...metadata,
      }
    } else {
      logger.error(
        result.err,
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
