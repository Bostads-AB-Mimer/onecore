/**
 * Self-contained service, ready to be extracted into a micro service if appropriate.
 *
 * All adapters such as database clients etc. should go into subfolders of the service,
 * not in a general top-level adapter folder to avoid service interdependencies (but of
 * course, there are always exceptions).
 */
import KoaRouter from '@koa/router'

import { getRentalProperty, getRoomTypes } from './adapters/contech-os-adapter'

import {
  getRoomTypeWithMaterialOptions,
  getMaterialOption,
  getMaterialChoicesByRoomTypes,
  getMaterialChoicesByApartmentId,
  saveMaterialChoices,
  getApartmentMaterialChoiceStatuses,
  filterRoomTypes,
  sortRoomTypes,
} from './adapters/material-options-adapter'
import {
  MaterialChoice,
  MaterialOptionGroup,
  Listing,
  ListingStatus,
} from 'onecore-types'
import { getParkingSpace } from './adapters/xpand-adapter'
import { getPublishedParkingSpaceFromSoapService } from './adapters/xpand-soap-adapter'
import { getRentalPropertyInfo } from './adapters/apps-mimer-nu-adapter'

/**
 * The routes of this service are exported as the routes object. The service can also have
 * other exports (named or default) to provide externally usable helper functions, types etc.
 */
export const routes = (router: KoaRouter) => {
  router.get('(.*)/rentalproperties/:id/material-options', async (ctx) => {
    const roomTypes = await getRoomTypes(ctx.params.id)
    const materialOptions = await getRoomTypeWithMaterialOptions(roomTypes)

    ctx.body = {
      roomTypes: materialOptions,
    }
  })

  router.get(
    '(.*)/rentalproperties/:id/material-options/:materialOptionId',
    async (ctx) => {
      const option = await getMaterialOption(ctx.params.materialOptionId)
      ctx.body = option
    }
  )

  router.get(
    '(.*)/rentalproperties/:id/rooms-with-material-choices',
    async (ctx) => {
      const apartmentId = ctx.params.id
      const roomTypes = await getRoomTypes(apartmentId)
      const matarialChoices = await getMaterialChoicesByRoomTypes({
        apartmentId: apartmentId,
      })
      for (const roomType of roomTypes) {
        roomType.materialOptionGroups = matarialChoices.filter(
          (materialGroup: MaterialOptionGroup) => {
            return materialGroup.roomTypeId == roomType.roomTypeId
          }
        )
      }
      ctx.body = {
        roomTypes: roomTypes.filter(filterRoomTypes).sort(sortRoomTypes),
      }
    }
  )

  router.get('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const apartmentId = ctx.params.id
    const materialChoices = await getMaterialChoicesByApartmentId(apartmentId)

    ctx.body = { materialChoices: materialChoices }
  })

  router.get(
    '(.*)/rentalproperties/:apartmentId/:contractId/material-choices',
    async (ctx) => {
      const apartmentId = ctx.params.apartmentId + '/' + ctx.params.contractId
      const materialChoices = await getMaterialChoicesByApartmentId(apartmentId)

      ctx.body = { materialChoices: materialChoices }
    }
  )

  // ?submitted=true|false
  router.get('(.*)/rentalproperties/material-choice-statuses', async (ctx) => {
    const apartmentChoiceStatuses = await getApartmentMaterialChoiceStatuses(
      ctx.params.projectCode
    )

    ctx.body = apartmentChoiceStatuses
  })

  router.post('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const result = await saveMaterialChoices(
      ctx.params.id,
      ctx.request.body as Array<MaterialChoice>
    )
    ctx.body = result
  })

  router.get('(.*)/rentalproperties/:id', async (ctx) => {
    const responseData = await getRentalProperty(ctx.params.id)

    ctx.body = responseData
  })
  //todo: refactor the subsequent requests to use same data source (use soap service instead of mimer.nu api)
  router.get('(.*)/parkingspaces/:id', async (ctx) => {
    const responseData = await getParkingSpace(ctx.params.id)

    ctx.body = responseData
  })

  router.get('(.*)/publishedParkingSpaces/:id', async (ctx) => {
    const xpandParkingSpace = await getPublishedParkingSpaceFromSoapService(
      ctx.params.id
    )
    if (!xpandParkingSpace) {
      ctx.status = 404
      return
    }
    const listing: Listing = {
      id: -1,
      rentalObjectCode: xpandParkingSpace.parkingSpaceId,
      address: xpandParkingSpace.address.street,
      monthlyRent: xpandParkingSpace.rent.currentRent.currentRent,
      districtCaption: xpandParkingSpace.freeTable1Caption,
      districtCode: xpandParkingSpace.freeTable1Code,
      blockCaption: xpandParkingSpace.freeTable3Caption,
      blockCode: xpandParkingSpace.freeTable3Code,
      objectTypeCaption: xpandParkingSpace.objectTypeCaption,
      objectTypeCode: xpandParkingSpace.objectTypeCode,
      rentalObjectTypeCaption: xpandParkingSpace.rentalObjectTypeCaption,
      rentalObjectTypeCode: xpandParkingSpace.rentalObjectTypeCode,
      publishedFrom: xpandParkingSpace.publishedFrom,
      publishedTo: xpandParkingSpace.publishedTo,
      vacantFrom: xpandParkingSpace.vacantFrom,
      status: ListingStatus.Active,
      waitingListType: xpandParkingSpace.waitingListType,
    }

    ctx.body = listing
  })

  router.get('(.*)/rentalPropertyInfo/:id', async (ctx) => {
    const responseData = await getRentalPropertyInfo(ctx.params.id)

    ctx.body = responseData
  })
}
