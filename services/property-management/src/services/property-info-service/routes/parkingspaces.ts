import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from 'onecore-utilities'
import { Listing, ListingStatus } from 'onecore-types'
import {
  getAllVacantParkingSpaces,
  getParkingSpace,
} from '../adapters/xpand-adapter'
import { getPublishedParkingSpaceFromSoapService } from '../adapters/xpand-soap-adapter'

/**
 * @swagger
 * tags:
 *   - name: Parking Spaces
 *     description: Endpoints related to parking spaces operations
 */

export const routes = (router: KoaRouter) => {
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
    const metadata = generateRouteMetadata(ctx)
    const responseData = await getParkingSpace(ctx.params.id)

    ctx.body = { content: responseData, ...metadata }
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
    const metadata = generateRouteMetadata(ctx)
    const xpandParkingSpace = await getPublishedParkingSpaceFromSoapService(
      ctx.params.id
    )
    if (!xpandParkingSpace) {
      ctx.status = 404
      ctx.body = {
        reason: 'No parking space found with the given id',
        ...metadata,
      }
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

    ctx.body = { content: listing, ...metadata }
  })

  /**
   * @swagger
   * /vacant-parkingspaces:
   *   get:
   *     summary: Get all vacant parking spaces
   *     description: Fetches a list of all vacant parking spaces available in the system.
   *     tags:
   *       - Listings
   *     responses:
   *       '200':
   *         description: Successfully retrieved the list of vacant parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/VacantParkingSpace'
   *       '500':
   *         description: Internal server error. Failed to fetch vacant parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.get('/vacant-parkingspaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const vacantParkingSpaces = await getAllVacantParkingSpaces()

    if (!vacantParkingSpaces.ok) {
      logger.error(
        vacantParkingSpaces.err,
        'Error fetching vacant parking spaces:'
      )
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching vacant parking spaces.',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { content: vacantParkingSpaces.data, ...metadata }
  })
}
