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
import {
  getRentalPropertyInfo,
  getParkingSpace,
  getMaintenanceUnits,
} from './adapters/xpand-adapter'
import { getPublishedParkingSpaceFromSoapService } from './adapters/xpand-soap-adapter'

/**
 * The routes of this service are exported as the routes object. The service can also have
 * other exports (named or default) to provide externally usable helper functions, types etc.
 */

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Property management
 *     description: Operations related to property management
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /rentalproperties/{id}/material-options:
   *   get:
   *     summary: Get room types with material options by rental property ID
   *     tags:
   *       - Property management
   *     description: Retrieve room types along with their material options for a specified rental property ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch room types and material options for.
   *     responses:
   *       '200':
   *         description: Successful response with room types and their material options.
   *         content:
   *          application/json:
   *             schema:
   *               type: object
   */
  router.get('(.*)/rentalproperties/:id/material-options', async (ctx) => {
    const roomTypes = await getRoomTypes(ctx.params.id)
    const materialOptions = await getRoomTypeWithMaterialOptions(roomTypes)

    ctx.body = {
      roomTypes: materialOptions,
    }
  })

  /**
   * @swagger
   * /rentalproperties/{id}/material-options/{materialOptionId}:
   *   get:
   *     summary: Get material option by ID for a specific rental property
   *     tags:
   *      - Property management
   *     description: Retrieve a specific material option for a rental property by its ID and the material option ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch material options from.
   *       - in: path
   *         name: materialOptionId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the material option to fetch.
   *     responses:
   *       '200':
   *         description: Successful response with the requested material option.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  router.get(
    '(.*)/rentalproperties/:id/material-options/:materialOptionId',
    async (ctx) => {
      const option = await getMaterialOption(ctx.params.materialOptionId)
      ctx.body = option
    }
  )

  /**
   * @swagger
   * /rentalproperties/{id}/rooms-with-material-choices:
   *   get:
   *     summary: Get rooms with material choices for a specific rental property
   *     tags:
   *       -  Property management
   *     description: Retrieve rooms with their associated material choices for a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch rooms with material choices for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested rooms and their material choices.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 roomTypes:
   *                   type: array
   *                   items:
   *                     type: object
   */
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

  /**
   * @swagger
   * /rentalproperties/{id}/material-choices:
   *   get:
   *     summary: Get material choices for a specific rental property
   *     tags:
   *       -  Property management
   *     description: Retrieve material choices associated with a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch material choices for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested material choices
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 materialChoices:
   *                   type: array
   *                   items:
   *                     type: object
   */
  router.get('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const apartmentId = ctx.params.id
    const materialChoices = await getMaterialChoicesByApartmentId(apartmentId)

    ctx.body = { materialChoices: materialChoices }
  })

  /**
   * @swagger
   * /rentalproperties/{apartmentId}/{contractId}/material-choices:
   *   get:
   *     summary: Get material choices for a specific apartment and contract
   *     tags:
   *       - Property management
   *     description: Retrieve material choices associated with a specific apartment and contract identified by {apartmentId} and {contractId}.
   *     parameters:
   *       - in: path
   *         name: apartmentId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the apartment to fetch material choices for.
   *       - in: path
   *         name: contractId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the contract to fetch material choices for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested material choices
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 materialChoices:
   *                   type: array
   *                   items:
   *                     type: object
   */
  router.get(
    '(.*)/rentalproperties/:apartmentId/:contractId/material-choices',
    async (ctx) => {
      const apartmentId = ctx.params.apartmentId + '/' + ctx.params.contractId
      const materialChoices = await getMaterialChoicesByApartmentId(apartmentId)

      ctx.body = { materialChoices: materialChoices }
    }
  )

  /**
   * @swagger
   * /rentalproperties/material-choice-statuses:
   *   get:
   *     summary: Get material choice statuses for rental properties
   *     tags:
   *       - Property management
   *     description: Retrieve the statuses of material choices associated with rental properties.
   *     parameters:
   *       - in: query
   *         name: projectCode
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional project code to filter the material choice statuses.
   *     responses:
   *       '200':
   *         description: Successful response with the material choice statuses
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   */

  router.get('(.*)/rentalproperties/material-choice-statuses', async (ctx) => {
    const apartmentChoiceStatuses = await getApartmentMaterialChoiceStatuses(
      ctx.params.projectCode
    )

    ctx.body = apartmentChoiceStatuses
  })

  /**
   * @swagger
   * /rentalproperties/{id}/material-choices:
   *   post:
   *     summary: Save material choices for a specific rental property
   *     tags:
   *       - Property management
   *     description: Save the material choices associated with a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to save material choices for.
   *     requestBody:
   *       description: Array of material choices to be saved
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: array
   *             items:
   *               type: object
   *     responses:
   *       '200':
   *         description: Successful response with the saved material choices
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   */
  router.post('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const result = await saveMaterialChoices(
      ctx.params.id,
      ctx.request.body as Array<MaterialChoice>
    )
    ctx.body = result
  })

  /**
   * @swagger
   * /rentalproperties/{id}:
   *   get:
   *     summary: Get rental property details by ID
   *     tags:
   *       -  Property management
   *     description: Retrieve the details of a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch details for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved rental property details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */

  router.get('(.*)/rentalproperties/:id', async (ctx) => {
    const responseData = await getRentalProperty(ctx.params.id)

    ctx.body = responseData
  })
  /**
   * @swagger
   * /parkingspaces/{id}:
   *   get:
   *     summary: Get parking space details by ID
   *     tags:
   *       - Property management
   *     description: Retrieve the details of a parking space identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the parking space to fetch details for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved parking space details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  //todo: refactor the subsequent requests to use same data source (use soap service instead of mimer.nu api)
  router.get('(.*)/parkingspaces/:id', async (ctx) => {
    const responseData = await getParkingSpace(ctx.params.id)

    ctx.body = responseData
  })

  /**
   * @swagger
   * /publishedParkingSpaces/{id}:
   *   get:
   *     summary: Get published parking space details by ID
   *     tags:
   *       - Property management
   *     description: Retrieve the details of a published parking space identified by {id} from the SOAP service.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the published parking space to fetch details for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved published parking space details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: integer
   *                   description: The ID of the listing.
   *                   example: -1
   *                 rentalObjectCode:
   *                   type: string
   *                   description: The rental object code of the parking space.
   *                 address:
   *                   type: string
   *                   description: The address of the parking space.
   *                 monthlyRent:
   *                   type: number
   *                   format: float
   *                   description: The monthly rent of the parking space.
   *                 districtCaption:
   *                   type: string
   *                   description: The caption of the district.
   *                 districtCode:
   *                   type: string
   *                   description: The code of the district.
   *                 blockCaption:
   *                   type: string
   *                   description: The caption of the block.
   *                 blockCode:
   *                   type: string
   *                   description: The code of the block.
   *                 objectTypeCaption:
   *                   type: string
   *                   description: The caption of the object type.
   *                 objectTypeCode:
   *                   type: string
   *                   description: The code of the object type.
   *                 rentalObjectTypeCaption:
   *                   type: string
   *                   description: The caption of the rental object type.
   *                 rentalObjectTypeCode:
   *                   type: string
   *                   description: The code of the rental object type.
   *                 publishedFrom:
   *                   type: string
   *                   format: date-time
   *                   description: The date from which the parking space is published.
   *                 publishedTo:
   *                   type: string
   *                   format: date-time
   *                   description: The date until which the parking space is published.
   *                 vacantFrom:
   *                   type: string
   *                   format: date-time
   *                   description: The date from which the parking space is vacant.
   *                 status:
   *                   type: string
   *                   description: The status of the listing.
   *                   enum: [Active, Inactive]
   *                 waitingListType:
   *                   type: string
   *                   description: The type of waiting list.
   *       '404':
   *         description: Published parking space not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Published parking space not found"
   */

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

  /**
   * @swagger
   * /rentalPropertyInfo/{id}:
   *   get:
   *     summary: Get rental property information by ID
   *     tags:
   *       - Property management
   *     description: Retrieve detailed information about a rental property identified by {id}.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the rental property to fetch information for.
   *     responses:
   *       '200':
   *         description: Successful response with the requested rental property information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */

  router.get('(.*)/rentalPropertyInfo/:id', async (ctx) => {
    const responseData = await getRentalPropertyInfo(ctx.params.id)
    ctx.body = responseData
  })

  /**
   * @swagger
   * /maintenanceUnits/{id}:
   *   get:
   *     summary: Get maintenance units by ID
   *     tags:
   *       - Property management
   *     description: Retrieve maintenance units associated with a specific ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the maintenance unit to fetch.
   *     responses:
   *       '200':
   *         description: Successful response with the requested maintenance units
   *         content:
   *          application/json:
   *             schema:
   *               type: object
   */

  router.get('(.*)/maintenanceUnits/:id', async (ctx) => {
    const responseData = await getMaintenanceUnits(ctx.params.id)
    ctx.body = responseData
  })
}
