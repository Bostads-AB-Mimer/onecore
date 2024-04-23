import KoaRouter from '@koa/router'
import {
  getContactForPhoneNumber,
  getLease,
  getLeasesForPnr,
  getLeasesForPropertyId,
} from '../../adapters/leasing-adapter'
import {
  RentalPropertyInfo,
  getRentalPropertyInfo,
} from '../../adapters/property-management-adapter'
import { Lease } from 'onecore-types'

interface RentalPropertyInfoWithLeases extends RentalPropertyInfo {
  leases: Lease[]
}

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
        case 'propertyId': {
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
      data: responseData.filter(
        (item: any) => item.id !== undefined && item.id !== null
      ),
    }
  })
}
