import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from 'onecore-utilities'
import { Listing, ListingStatus } from 'onecore-types'
import {
  getAllVacantParkingSpaces,
  getParkingSpace,
  getParkingSpaceOld,
  getParkingSpaces,
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
   * /parking-spaces:
   *   get:
   *     summary: Get parking spaces by codes
   *     description: Fetches parking spaces filtered by includeRentalObjectCodes.
   *     tags:
   *       - RentalObject
   *     parameters:
   *       - in: query
   *         name: includeRentalObjectCodes
   *         schema:
   *           type: string
   *         description: Comma-separated list of rental object codes to include.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the parking spaces.
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
   *         description: Internal server error. Failed to fetch parking spaces.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.get('(.*)/parking-spaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const codesParam = ctx.query.includeRentalObjectCodes as string | undefined
    const includeRentalObjectCodes = codesParam
      ? codesParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined

    const result = await getParkingSpaces(includeRentalObjectCodes)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
      return
    }

    if (result.err == 'parking-spaces-not-found') {
      ctx.status = 404
      ctx.body = {
        error: `No parking spaces found for rental object codes: ${includeRentalObjectCodes}`,
        ...metadata,
      }
      return
    }

    if (result.err == 'unknown') {
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching parking spaces.',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /parking-spaces/by-code/{rentalObjectCode}:
   *   get:
   *     summary: Get a parking space by rental object code
   *     description: Fetches a parking space by Rental Object Code.
   *     tags:
   *       - RentalObject
   *     responses:
   *       '200':
   *         description: Successfully retrieved the parking space.
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
   *         description: Internal server error. Failed to fetch parking space.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.get('(.*)/parking-spaces/by-code/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const rentalObjectCode = ctx.params.rentalObjectCode

    const result = await getParkingSpace(rentalObjectCode)

    if (result.ok) {
      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
      return
    }

    if (result.err == 'parking-space-not-found') {
      ctx.status = 404
      ctx.body = {
        error: `An error occurred while fetching parking space by Rental Object Code: ${rentalObjectCode}`,
        ...metadata,
      }
      return
    }

    ctx.status = 500
    ctx.body = {
      error: 'An error occurred while fetching parking spaces.',
      ...metadata,
    }
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
  //todo: refactor the subsequent requests to use same data source as the two above)

  router.get('(.*)/parkingspaces/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const responseData = await getParkingSpaceOld(ctx.params.id)

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
      publishedFrom: xpandParkingSpace.publishedFrom,
      publishedTo: xpandParkingSpace.publishedTo,
      status: ListingStatus.Active,
      rentalRule:
        xpandParkingSpace.waitingListType == 'Bilplats (extern)'
          ? 'NON_SCORED'
          : 'SCORED',
      listingCategory: 'PARKING_SPACE',
      rentalObject: {
        rentalObjectCode: xpandParkingSpace.parkingSpaceId,
        address: xpandParkingSpace.address.street,
        monthlyRent: xpandParkingSpace.rent.currentRent.currentRent,
        districtCaption: xpandParkingSpace.freeTable1Caption,
        districtCode: xpandParkingSpace.freeTable1Code,
        blockCaption: xpandParkingSpace.freeTable3Caption,
        blockCode: xpandParkingSpace.freeTable3Code,
        objectTypeCaption: xpandParkingSpace.objectTypeCaption,
        objectTypeCode: xpandParkingSpace.objectTypeCode,
        vacantFrom: xpandParkingSpace.vacantFrom,
        restidentalAreaCaption: xpandParkingSpace.freeTable1Caption,
        restidentalAreaCode: xpandParkingSpace.freeTable1Code,
      },
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
