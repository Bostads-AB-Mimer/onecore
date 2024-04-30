import KoaRouter from '@koa/router'
import {
  getContactForPhoneNumber,
  getLease,
  getLeasesForPnr,
  getLeasesForPropertyId,
} from '../../adapters/leasing-adapter'
import { getRentalPropertyInfo } from '../../adapters/property-management-adapter'
import {
  ApartmentInfo,
  CommercialSpaceInfo,
  Lease,
  RentalPropertyInfo,
} from 'onecore-types'
import { createNewTicket } from './adapters/odoo-adapter'
import { getTicketByContactCode } from './adapters/odoo-adapter'

interface RentalPropertyInfoWithLeases extends RentalPropertyInfo {
  leases: Lease[]
}

const equipmentList = ['TM', 'MA', 'TT', 'TS']

export const routes = (router: KoaRouter) => {
  router.get('(.*)/propertyInfo/:number', async (ctx: any) => {
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
      console.log('Error', error)
      ctx.throw(500, 'Internal server error')
    }

    ctx.body = {
      data: responseData,
    }
  })

  router.get('(.*)/ticketsByContactCode/:code', async (ctx: any) => {
    try {
      const tickets = await getTicketByContactCode(ctx.params.code)
      if (tickets && tickets.length > 0) {
        ctx.body = {
          totalCount: tickets.length,
          workOrders: tickets,
        }
      } else {
        ctx.status = 404
        ctx.body = { error: 'No tickets found' }
        return
      }
    } catch (error) {
      console.error('Error:', error)
      ctx.status = 500
      ctx.body = { error: 'Internal server error' }
      return
    }
  })

  router.post('(.*)/createTicket/:contactCode', async (ctx) => {
    try {
      if (!ctx.params.contactCode) return ctx.throw(400, 'Contact code missing')
      const { rentalObjectCode, accessOptions, pet, rows } = ctx.request.body
      const laundryRoomTickets = rows.filter(
        (row: any) => row.locationCode === 'TV'
      )

      if (laundryRoomTickets.length === 0)
        return ctx.throw(
          400,
          'Bad request, no laundry room tickets found in request'
        )

      for (const ticket of laundryRoomTickets) {
        if (equipmentList.includes(ticket.partOfBuildingCode)) {
          const rentalPropertyInfo =
            await getRentalPropertyInfo(rentalObjectCode)

          console.log('rentalPropertyInfo', rentalPropertyInfo)

          const laundryRoom = rentalPropertyInfo.maintenanceUnits?.find(
            (unit) => unit.type.toUpperCase() === 'TVÄTTSTUGA'
          )

          if (!laundryRoom)
            return ctx.throw(400, 'No laundry room found in rental property')

          const ticketId = await createNewTicket({
            contact_code: ctx.params.contactCode,
            rental_property_id: rentalObjectCode,
            hearing_impaired: accessOptions.type === 1,
            phone_number: accessOptions.phoneNumber,
            call_between: accessOptions.callBetween,
            pet: pet,
            space_code: ticket.locationCode,
            equipment_code: ticket.partOfBuildingCode,
            description: ticket.description,
            name: 'Felanmäld tvättstuga - ' + ticket.partOfBuildingCode,
            email_address: accessOptions.email,
            building_code: (
              rentalPropertyInfo.property as ApartmentInfo | CommercialSpaceInfo
            ).buildingCode,
            building: (
              rentalPropertyInfo.property as ApartmentInfo | CommercialSpaceInfo
            ).building,
            estate_code: laundryRoom.estateCode,
            estate: laundryRoom.estate,
            code: laundryRoom.code,
            space_caption: laundryRoom.caption,
          })

          ctx.body = { data: `Ticket created with ID ${ticketId}` }
        }
      }
    } catch (error) {
      console.error('Error creating a new ticket:', error)
      ctx.status = 500
      ctx.body = {
        message: 'Failed to create a new ticket',
      }
    }
  })
}
