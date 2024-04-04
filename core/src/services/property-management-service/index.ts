/**
 * Self-contained service, ready to be extracted into a microservice if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'
import {
  getRentalProperty,
  getRoomTypeWithMaterialOptions,
  getMaterialOption,
  getMaterialChoices,
  saveMaterialChoice,
  getMaterialChoiceStatuses,
  getRoomsWithMaterialChoices,
} from '../../adapters/property-management-adapter'
import { getFloorPlanStream } from './adapters/document-adapter'
import { createLeaseForExternalParkingSpace } from '../../processes/parkingspaces/external'
import { createNoteOfInterestForInternalParkingSpace } from '../../processes/parkingspaces/internal'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rentalproperties/:id/floorplan', async (ctx) => {
    const response = await getFloorPlanStream(ctx.params.id)
    ctx.type = response.headers['content-type']?.toString() ?? 'image/jpeg'
    ctx.body = response.data
  })

  router.get('(.*)/rentalproperties/:id/material-options', async (ctx) => {
    const roomTypes = await getRoomTypeWithMaterialOptions(ctx.params.id)

    ctx.body = roomTypes
  })

  router.get(
    '(.*)/rentalproperties/:id/material-option/:materialOptionId',
    async (ctx) => {
      const option = await getMaterialOption(
        ctx.params.id,
        ctx.params.materialOptionId
      )

      ctx.body = option
    }
  )

  router.get(
    '(.*)/rentalproperties/:apartmentId/:contractId/material-choices',
    async (ctx) => {
      const materialChoices = await getMaterialChoices(
        ctx.params.apartmentId,
        ctx.params.contractId
      )

      ctx.body = materialChoices
    }
  )

  router.get(
    '(.*)/rentalproperties/:id/rooms-with-material-choices',
    async (ctx) => {
      const materialChoices = await getRoomsWithMaterialChoices(ctx.params.id)

      ctx.body = materialChoices
    }
  )

  router.get('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const materialChoices = await getMaterialChoices(ctx.params.id)

    ctx.body = materialChoices
  })

  router.get('(.*)/rentalproperties/material-choice-statuses', async (ctx) => {
    const materialChoiceStatuses = await getMaterialChoiceStatuses(
      ctx.params.projectCode
    )

    if (ctx.query.includeRentalProperties === 'true') {
      for (const materialChoiceStatus of materialChoiceStatuses) {
        materialChoiceStatus.rentalProperty = await getRentalProperty(
          materialChoiceStatus.apartmentId
        )
      }
    }

    ctx.body = materialChoiceStatuses
  })

  router.post('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    await getMaterialChoices(ctx.params.id)

    if (ctx.request.body) {
      const result = await saveMaterialChoice(ctx.params.id, ctx.request.body)

      ctx.body = result
    }
  })

  router.get('(.*)/rentalproperties/:id', async (ctx) => {
    const responseData = await getRentalProperty(ctx.params.id)

    ctx.body = {
      data: responseData,
    }
  })

  router.post('(.*)/parkingspaces/:parkingSpaceId/leases', async (ctx) => {
    const parkingSpaceId = ctx.params.parkingSpaceId

    if (!parkingSpaceId) {
      ctx.status = 400
      ctx.body = {
        message:
          'Parking space id is missing. It needs to be passed in the url.',
      }

      return
    }

    const contactId = ctx.request.body.contactId

    if (!contactId) {
      ctx.status = 400
      ctx.body = {
        message:
          'Contact id is missing. It needs to be passed in the body (contactId)',
      }

      return
    }

    const startDate = ctx.request.body.startDate

    try {
      const result = await createLeaseForExternalParkingSpace(
        parkingSpaceId,
        contactId,
        startDate
      )

      ctx.status = result.httpStatus
      ctx.body = result.response
    } catch (error) {
      // Step 6: Communicate error to dev team and customer service
      console.log('Error', error)
      ctx.status = 500
      ctx.body = {
        message: 'A technical error has occured',
      }
    }
  })

  router.post(
    '(.*)/parkingspaces/:parkingSpaceId/noteofinterests',
    async (ctx) => {
      const parkingSpaceId = ctx.params.parkingSpaceId
      if (!parkingSpaceId) {
        ctx.status = 400
        ctx.body = {
          message:
            'Parking space id is missing. It needs to be passed in the url.',
        }

        return
      }

      const contactId = ctx.request.body.contactId

      if (!contactId) {
        ctx.status = 400
        ctx.body = {
          message:
            'Contact id is missing. It needs to be passed in the body (contactId)',
        }
        return
      }

      try {
        const result = await createNoteOfInterestForInternalParkingSpace(
          parkingSpaceId,
          contactId
        )

        ctx.status = result.httpStatus
        ctx.body = result.response
      } catch (error) {
        // Step 6: Communicate error to dev team and customer service
        console.log('Error', error)
        ctx.status = 500
        ctx.body = {
          message: 'A technical error has occured',
        }
      }
    }
  )
}
