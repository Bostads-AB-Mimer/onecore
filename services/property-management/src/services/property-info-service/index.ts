/**
 * Self-contained service, ready to be extracted into a micro service if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'

import {
  getRentalProperty,
  getRoomTypes,
  getRoomType,
  getApartmentInfo,
} from './adapters/contech-os-adapter'

import {
  getRoomTypeWithMaterialOptions,
  getSingleMaterialOption,
  getMaterialOptionGroup,
  getMaterialOptionGroups,
  getMaterialOption,
  getMaterialChoices,
} from './adapters/material-options-adapter'

/**
 * The routes of this service are exported as the routes object. The service can also have
 * other exports (named or default) to provide externally usable helper functions, types etc.
 */
export const routes = (router: KoaRouter) => {
  router.get('(.*)/rentalproperties/:id/material-options', async (ctx) => {
    const roomTypes = await getRoomTypes(ctx.params.id)
    const materialOptions = await getRoomTypeWithMaterialOptions(
      ctx.params.id,
      roomTypes
    )

    ctx.body = {
      roomTypes: materialOptions,
    }
  })

  router.get(
    '(.*)/rentalproperties/:id/material-options/details',
    async (ctx) => {
      if (
        ctx.request.query.roomTypeId &&
        ctx.request.query.materialOptionGroupId &&
        ctx.request.query.materialOptionId
      ) {
        const apartmentId = ctx.params.id
        const roomTypeId = ctx.request.query.roomTypeId[0]
        const roomType = await getRoomType(apartmentId, roomTypeId)

        if (roomType == undefined) {
          ctx.status = 400
          ctx.body = {
            message:
              'Room type ' +
              roomTypeId +
              ' does not exist in apartment ' +
              apartmentId,
          }
          return
        }

        const option = await getSingleMaterialOption(
          apartmentId,
          roomType,
          ctx.request.query.materialOptionGroupId[0],
          ctx.request.query.materialOptionId[0]
        )

        ctx.body = {
          materialOption: option,
        }
      }
    }
  )

  router.get('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const apartmentId = ctx.params.id
    const roomTypes = await getRoomTypes(apartmentId)
    const materialChoices = await getMaterialChoices(apartmentId, roomTypes)

    ctx.body = materialChoices
  })

  router.get('(.*)/rentalproperties/:id/room-types', async (ctx) => {
    const roomTypes = await getRoomTypes(ctx.params.id)

    ctx.body = roomTypes
  })

  router.get('(.*)/apartmentinfo/:id', async (ctx) => {
    const responseData = await getApartmentInfo(ctx.params.id)

    ctx.body = responseData
  })

  router.get('(.*)/rentalproperties/:id', async (ctx) => {
    const responseData = await getRentalProperty(ctx.params.id)

    ctx.body = responseData
  })

  router.get(
    '(.*)/room-types/:roomTypeId/material-option-groups/:optionGroupId',
    async (ctx) => {
      const group = await getMaterialOptionGroup(
        ctx.params.roomTypeId,
        ctx.params.optionGroupId
      )

      ctx.body = group
    }
  )

  router.get(
    '(.*)/room-types/:roomTypeId/material-option-groups',
    async (ctx) => {
      const groups = await getMaterialOptionGroups(ctx.params.roomTypeId)

      ctx.body = groups
    }
  )

  router.get(
    '(.*)/room-types/:roomTypeId/material-option-groups/:optionGroupId/options/:optionId',
    async (ctx) => {
      const option = await getMaterialOption(
        ctx.params.roomTypeId,
        ctx.params.optionGroupId,
        ctx.params.optionId
      )

      ctx.body = option
    }
  )
}
