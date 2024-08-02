import KoaRouter from '@koa/router'
import {
  getContact,
  getContactForPhoneNumber,
  getLease,
  getLeasesForPnr,
  getLeasesForPropertyId,
} from '../../adapters/leasing-adapter'
import {
  getMaintenanceUnitsForRentalProperty,
  getRentalPropertyInfo,
} from '../../adapters/property-management-adapter'
import {
  ApartmentInfo,
  CommercialSpaceInfo,
  Lease,
  RentalPropertyInfo,
} from 'onecore-types'
import {
  createTicket,
  getMaintenanceTeamId,
  getTicketByContactCode,
  transformEquipmentCode,
} from './adapters/odoo-adapter'
import { logger, generateRouteMetadata } from 'onecore-utilities'

interface RentalPropertyInfoWithLeases extends RentalPropertyInfo {
  leases: Lease[]
}

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Ticketing service
 *     description: Operations related to tickets in Odoo
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
   * /propertyInfo/{number}:
   *   get:
   *     summary: Get property information by different identifiers
   *     tags:
   *       - Ticketing service
   *     description: Retrieves property information along with associated leases based on the provided identifier type.
   *     parameters:
   *       - in: path
   *         name: number
   *         required: true
   *         schema:
   *           type: string
   *         description: The identifier value for fetching property information.
   *       - in: query
   *         name: typeOfNumber
   *         required: true
   *         schema:
   *           type: string
   *           enum: [rentalPropertyId, leaseId, pnr, phoneNumber]
   *         description: The type of the identifier used to fetch property information.
   *     responses:
   *       '200':
   *         description: Successfully retrieved property information with leases.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       '500':
   *         description: Internal server error. Failed to retrieve property information.
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
  router.get('(.*)/propertyInfo/:number', async (ctx: any) => {
    const metadata = generateRouteMetadata(ctx, ['typeOfNumber'])
    const responseData: any = []

    const getRentalPropertyInfoWithLeases = async (lease: Lease) => {
      const propertyInfo = await getRentalPropertyInfo(lease.rentalPropertyId)
      const propertyInfoWithLeases: RentalPropertyInfoWithLeases = {
        ...propertyInfo,
        leases: [lease],
      }
      return propertyInfoWithLeases
    }

    try {
      switch (ctx.query.typeOfNumber) {
        // getRentalPropertyInfo can be refactored into separate endpoints for fetching more specific data. From leases we know if the property is an apartment or a parking space or a commercial space.
        // However, fetching property type from leases brings an issue when searching for a property without an active lease.

        case 'rentalPropertyId': {
          const propertyInfo = await getRentalPropertyInfo(ctx.params.number)
          const leases = await getLeasesForPropertyId(
            ctx.params.number,
            undefined,
            'true'
          )
          const propertyInfoWithLeases: RentalPropertyInfoWithLeases = {
            ...propertyInfo,
            leases: leases,
          }
          responseData.push(propertyInfoWithLeases)
          break
        }
        case 'leaseId': {
          const lease = await getLease(
            encodeURIComponent(ctx.params.number),
            'true'
          )
          if (lease) {
            const propertyInfoWithLease =
              await getRentalPropertyInfoWithLeases(lease)
            responseData.push(propertyInfoWithLease)
          }
          break
        }
        case 'pnr': {
          const leases = await getLeasesForPnr(
            ctx.params.number,
            undefined,
            'true'
          )
          if (leases) {
            for (const lease of leases) {
              const propertyInfoWithLease =
                await getRentalPropertyInfoWithLeases(lease)
              responseData.push(propertyInfoWithLease)
            }
          }
          break
        }
        case 'phoneNumber': {
          const contact = await getContactForPhoneNumber(ctx.params.number)
          if (contact) {
            const leases = await getLeasesForPnr(
              contact.nationalRegistrationNumber,
              undefined,
              'true'
            )
            if (leases) {
              for (const lease of leases) {
                const propertyInfoWithLease =
                  await getRentalPropertyInfoWithLeases(lease)
                responseData.push(propertyInfoWithLease)
              }
            }
          }
          break
        }

        default:
          break
      }
    } catch (error) {
      logger.error(error, 'Error retrieving property info')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }

    ctx.body = {
      content: responseData,
      ...metadata,
    }
  })

  /**
   * @swagger
   * /ticketsByContactCode/{code}:
   *   get:
   *     summary: Get tickets by contact code
   *     tags:
   *       - Ticketing service
   *     description: Retrieves all tickets associated with a given contact code.
   *     parameters:
   *       - in: path
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code to search for tickets.
   *     responses:
   *       '200':
   *         description: Successfully retrieved tickets.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalCount:
   *                   type: integer
   *                   description: The total number of tickets found.
   *                 workOrders:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       // Define the properties of the work order object here
   *                 message:
   *                   type: string
   *                   description: Message indicating no tickets found.
   *       '404':
   *         description: No tickets found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: No tickets found
   *       '500':
   *         description: Internal server error. Failed to retrieve tickets.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/ticketsByContactCode/:code', async (ctx: any) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const tickets = await getTicketByContactCode(ctx.params.code)
      if (tickets && tickets.length > 0) {
        ctx.status = 200
        ctx.body = {
          content: {
            totalCount: tickets.length,
            workOrders: tickets,
          },
          ...metadata,
        }
      } else {
        ctx.status = 404
        ctx.body = { reason: 'No tickets found', ...metadata }
        return
      }
    } catch (error) {
      logger.error(error, 'Error getting tickets by contact code')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /maintenanceUnitsByRentalPropertyId/{rentalPropertyId}/{type}:
   *   get:
   *     summary: Get maintenance units by rental property ID
   *     tags:
   *       - Ticketing service
   *     description: Retrieves all maintenance units associated with a given rental property ID. Optionally, filter the maintenance units by type.
   *     parameters:
   *       - in: path
   *         name: rentalPropertyId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental property ID to search for maintenance units.
   *       - in: path
   *         name: type
   *         required: false
   *         schema:
   *           type: string
   *         description: The type of maintenance units to filter by (optional).
   *     responses:
   *       '200':
   *         description: Successfully retrieved maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                 message:
   *                   type: string
   *                   description: Message indicating no maintenance units found.
   *       '404':
   *         description: No maintenance units found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: No maintenance units found
   *       '500':
   *         description: Internal server error. Failed to retrieve maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '(.*)/maintenanceUnitsByRentalPropertyId/:rentalPropertyId/:type?',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      try {
        const maintenanceUnits = await getMaintenanceUnitsForRentalProperty(
          ctx.params.rentalPropertyId
        )
        if (maintenanceUnits && maintenanceUnits.length > 0) {
          // Filter by type if type is provided
          if (ctx.params.type) {
            ctx.status = 200
            ctx.body = {
              content: maintenanceUnits.filter(
                (unit) =>
                  unit.type.toUpperCase() === ctx.params.type.toUpperCase()
              ),
              ...metadata,
            }
            return
          }
          // Return all maintenance units if no type is provided
          ctx.status = 200
          ctx.body = { content: maintenanceUnits, ...metadata }
        } else {
          ctx.status = 404
          ctx.body = { reason: 'No maintenance units found' }
          logger.info('No maintenance units found')
          return
        }
      } catch (error) {
        logger.error(error, 'Error retreiving maintenance units by property')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }
    }
  )
  /**
   * @swagger
   * /maintenanceUnitsByContactCode/{contactCode}:
   *   get:
   *     summary: Get maintenance units by contact code
   *     tags:
   *       - Ticketing service
   *     description: Retrieves all maintenance units associated with a given contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code to search for maintenance units.
   *     responses:
   *       '200':
   *         description: Successfully retrieved maintenance units.
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
   *                       // Define the properties of the maintenance unit object here
   *                 message:
   *                   type: string
   *                   description: Message indicating no maintenance units found.
   *       '400':
   *         description: Bad request, contact not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Contact not found
   *       '404':
   *         description: No maintenance units found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: No maintenance units found
   *       '500':
   *         description: Internal server error. Failed to retrieve maintenance units.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/maintenanceUnitsByContactCode/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const contact = await getContact(ctx.params.contactCode)
      if (!contact) {
        ctx.status = 404
        ctx.body = { reason: 'Contact not found', ...metadata }
        return
      }
      const leases = await getLeasesForPnr(
        contact.nationalRegistrationNumber,
        'false',
        'false'
      )
      const promises = leases
        .filter(
          (lease) =>
            lease.type.toLocaleLowerCase().trimEnd() === 'bostadskontrakt'
        )
        .map((lease) =>
          getMaintenanceUnitsForRentalProperty(lease.rentalPropertyId)
        )

      const maintenanceUnits = (await Promise.all(promises)).flat()

      if (maintenanceUnits && maintenanceUnits.length > 0) {
        ctx.status = 200
        ctx.body = { content: maintenanceUnits, ...metadata }
      } else {
        ctx.status = 404
        ctx.body = { reason: 'No maintenance units found', ...metadata }
        logger.info('No maintenance units found')
        return
      }
    } catch (error) {
      console.error('Error:', error)
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }
  })

  /**
   * @swagger
   * /createTicket/{contactCode}:
   *   post:
   *     summary: Create a new ticket for maintenance
   *     tags:
   *       - Ticketing service
   *     description: Creates a new maintenance ticket based on the provided contact code and ticket details.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The contact code to associate with the ticket.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               RentalObjectCode:
   *                 type: string
   *                 description: The rental object code associated with the ticket.
   *               AccessOptions:
   *                 type: object
   *                 properties:
   *                   Type:
   *                     type: integer
   *                     description: Type of access option (1 for hearing impaired).
   *                   PhoneNumber:
   *                     type: string
   *                     description: Phone number for contact.
   *                   CallBetween:
   *                     type: string
   *                     description: Time interval for calls.
   *                   Email:
   *                     type: string
   *                     description: Email address for contact.
   *               Pet:
   *                 type: boolean
   *                 description: Indicates if there is a pet involved.
   *               Rows:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     LocationCode:
   *                       type: string
   *                       description: Code for the location of the ticket.
   *                     PartOfBuildingCode:
   *                       type: string
   *                       description: Code for the part of the building.
   *                     Description:
   *                       type: string
   *                       description: Description of the ticket.
   *                     MaintenanceUnitCode:
   *                       type: string
   *                       description: Code for the maintenance unit.
   *                     MaintenanceUnitCaption:
   *                       type: string
   *                       description: Caption for the maintenance unit.
   *     responses:
   *       '200':
   *         description: Ticket successfully created.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   description: Confirmation message with the ID of the created ticket.
   *       '400':
   *         description: Bad request. Contact code or required fields missing.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Contact code is missing. It needs to be passed in the url.
   *       '404':
   *         description: No tickets found in request.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 reason:
   *                   type: string
   *                   example: No tickets found in request
   *       '500':
   *         description: Internal server error. Failed to create a new ticket.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Failed to create a new ticket
   *     security:
   *       - bearerAuth: []
   */
  router.post('(.*)/createTicket/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      if (!ctx.params.contactCode) {
        ctx.status = 400
        ctx.body = {
          reason: 'Contact code is missing. It needs to be passed in the url.',
          ...metadata,
        }
        return
      }
      const { RentalObjectCode, AccessOptions, Pet, Rows, Images } =
        ctx.request.body

      if (Rows.length === 0) {
        ctx.status = 404
        ctx.body = {
          reason: 'No tickets found in request',
          ...metadata,
        }
        return
      }
      const maintenanceTeamId = await getMaintenanceTeamId(
        'Vitvarureperatör Mimer'
      )

      const propertyInfo = await getRentalPropertyInfo(RentalObjectCode)
      const leases = await getLeasesForPropertyId(
        RentalObjectCode,
        'false',
        'true'
      )

      const propertyInfoWithLeases: RentalPropertyInfoWithLeases = {
        ...propertyInfo,
        leases: leases.filter((lease: Lease) => !lease.terminationDate),
      }
      const tenants: any = propertyInfoWithLeases.leases[0].tenants

      for (const ticket of Rows) {
        const laundryRoom = propertyInfoWithLeases.maintenanceUnits?.find(
          (unit) => unit.type.toUpperCase() === 'TVÄTTSTUGA'
        )

        if (!laundryRoom) {
          ctx.status = 404
          ctx.body = {
            reason: 'No laundry room found for rental property',
            ...metadata,
          }
          return
        }

        const type = 'Tvättstuga'
        const address = laundryRoom.caption.replace('TVÄTTSTUGA ', '')

        const ticketId = await createTicket({
          contact_code: ctx.params.contactCode,
          rental_property_id: RentalObjectCode,
          hearing_impaired: AccessOptions.Type === 1,
          phone_number: AccessOptions.PhoneNumber || tenants[0].phoneNumber[0],
          call_between: AccessOptions.CallBetween,
          pet: Pet,
          space_code: ticket.LocationCode,
          equipment_code: ticket.PartOfBuildingCode,
          description: ticket.Description,
          images: Images,
          name:
            'Felanmäld tvättstuga - ' +
            transformEquipmentCode(ticket.PartOfBuildingCode),
          email_address: AccessOptions.Email || tenants[0].emailAddress,
          building_code: (
            propertyInfoWithLeases.property as
              | ApartmentInfo
              | CommercialSpaceInfo
          ).buildingCode,
          building: (
            propertyInfoWithLeases.property as
              | ApartmentInfo
              | CommercialSpaceInfo
          ).building,
          estate_code: laundryRoom.estateCode,
          estate: laundryRoom.estateCode + ' ' + laundryRoom.estate,
          code: laundryRoom.code,
          space_caption: type,
          maintenance_team_id: maintenanceTeamId,
          tenant_id: tenants[0].firstName + ' ' + tenants[0].lastName,
          national_registration_number: tenants[0].nationalRegistrationNumber,
          address: address,
          maintenance_unit_code: ticket.MaintenanceUnitCode,
          maintenance_unit_caption: ticket.MaintenanceUnitCaption,
        })

        ctx.status = 200
        ctx.body = {
          message: `Ticket created with ID ${ticketId}`,
          ...metadata,
        }
      }
    } catch (error) {
      logger.error(error, 'Error creating new ticket')
      ctx.status = 500
      ctx.body = {
        error: 'Failed to create a new ticket',
        ...metadata,
      }
    }
  })
}
