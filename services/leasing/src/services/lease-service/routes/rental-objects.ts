import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import * as xpandAdapter from '../adapters/xpand/rental-object-adapter'

import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import z from 'zod'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { RentalObjectAvailabilityInfo } from '@onecore/types'
import {
  determineVacantFrom,
  hasNoActiveBlock,
} from '../helpers/rental-object-availability-helpers'

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
   *   post:
   *     summary: Get parking spaces by codes
   *     description: Fetches parking spaces filtered by includeRentalObjectCodes.
   *     tags:
   *       - RentalObject
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               includeRentalObjectCodes:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of rental object codes to include.
   *                 example: ["ABC123", "DEF456", "GHI789"]
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
   *                     $ref: '#/components/schemas/RentalObject'
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
  router.post('(.*)/parking-spaces', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const requestBody = ctx.request.body as
      | { includeRentalObjectCodes?: string[] }
      | undefined
    const includeRentalObjectCodes =
      requestBody?.includeRentalObjectCodes?.filter(Boolean) ?? []

    // Get both parking space info from xpand and availability info from tenfast in parallel
    const [parkingSpaceResult, rentalObjectAvailabilitiesResponse] =
      await Promise.all([
        xpandAdapter.getParkingSpaces(includeRentalObjectCodes),
        tenfastAdapter.getRentalObjectAvailabilityInfo(
          includeRentalObjectCodes,
          false
        ),
      ])

    if (!parkingSpaceResult.ok) {
      logger.error(
        { err: parkingSpaceResult.err },
        'Error fetching parking spaces:'
      )

      if (parkingSpaceResult.err == 'parking-spaces-not-found') {
        ctx.status = 404
        ctx.body = {
          error: `No parking spaces found for rental object codes: ${includeRentalObjectCodes}`,
          ...metadata,
        }
        return
      }

      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching parking spaces.',
        ...metadata,
      }
      return
    }

    if (!rentalObjectAvailabilitiesResponse.ok) {
      logger.error(
        { err: rentalObjectAvailabilitiesResponse.err },
        'Error fetching availability for parking spaces:'
      )
      ctx.status = 500
      ctx.body = {
        error:
          'An error occurred while fetching availability for parking spaces.',
        ...metadata,
      }
      return
    }

    parkingSpaceResult.data.forEach((ps) => {
      const availability = rentalObjectAvailabilitiesResponse.data.find(
        (availability) => availability.rentalObjectCode === ps.rentalObjectCode
      )

      // Match availability info to rental object and enrich availability info with
      // vacantFrom based on block end date and end date of last active lease
      if (availability) {
        ps.availabilityInfo = availability

        ps.availabilityInfo.vacantFrom = determineVacantFrom(
          ps.availabilityInfo.vacantFrom,
          ps.blockStartDate,
          ps.blockEndDate
        )
      }
    })

    ctx.status = 200
    ctx.body = { content: parkingSpaceResult.data, ...metadata }
    return
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
   *                     $ref: '#/components/schemas/RentalObject'
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

    //Get parking space by rental object code from xpand
    const result = await xpandAdapter.getParkingSpace(rentalObjectCode)

    if (result.ok) {
      //Get availability info for the parking space from tenfast
      const availabilityResult =
        await tenfastAdapter.getAvailabilityForRentalObject(
          rentalObjectCode,
          false
        )

      if (availabilityResult.ok) {
        //Enrich availability info with vacantFrom based on block end date and end date of last active lease
        availabilityResult.data.vacantFrom = determineVacantFrom(
          availabilityResult.data.vacantFrom,
          result.data.blockStartDate,
          result.data.blockEndDate
        )

        ctx.status = 200
        ctx.body = {
          content: {
            ...result.data,
            availabilityInfo: availabilityResult.data,
          },
          ...metadata,
        }
        return
      }

      logger.error(
        { err: availabilityResult.err, rentalObjectCode: rentalObjectCode },
        `Could not get rent from Tenfast`
      )

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
   *                     $ref: '#/components/schemas/RentalObject'
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
    logger.info(metadata, 'Fetching all vacant parking spaces')

    //Get all vacant rental objects of type parking space from tenfast
    let availabilityResult =
      await tenfastAdapter.getAvailabilityForVacantRentalObjects(
        tenfastAdapter.RentalObjectType.ParkingSpace
      )

    if (!availabilityResult.ok) {
      logger.error(
        { err: availabilityResult.err },
        'Error fetching availability for vacant rental objects from tenfast:'
      )
      ctx.status = 500
      ctx.body = {
        error:
          'An error occurred while fetching availability for vacant rental objects from tenfast.',
        ...metadata,
      }
      return
    }

    if (!availabilityResult.data || availabilityResult.data.length === 0) {
      logger.info('No vacant rental objects found in tenfast')
      ctx.status = 200
      ctx.body = { content: [], ...metadata }
      return
    }

    console.log(
      'Antal lediga hyresobjekt från tenfast:',
      availabilityResult.data?.length
    )

    //Get parking spaces for the available rental objects from xpand
    const rentalObjectResult = await xpandAdapter.getParkingSpaces(
      availabilityResult.data.map(
        (availability) => availability.rentalObjectCode
      )
    )

    if (!rentalObjectResult.ok) {
      logger.error(
        { err: rentalObjectResult.err },
        'Error fetching rental objects from xpand:'
      )
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching rental objects from xpand.',
        ...metadata,
      }
      return
    }

    console.log(
      'Antal parkeringsplatser från xpand:',
      rentalObjectResult.data.length
    )

    // Match availability info to rental objects
    rentalObjectResult.data.forEach((ps) => {
      ps.availabilityInfo = availabilityResult.data?.find(
        (availability: RentalObjectAvailabilityInfo) =>
          availability.rentalObjectCode === ps.rentalObjectCode
      )
    })

    // Filter out parking spaces with an active or future block (including blocks with no end date)
    const vacantRentalObjects = rentalObjectResult.data.filter(hasNoActiveBlock)
    console.log(
      'after filtering on block end date, antal lediga parkeringsplatser:',
      vacantRentalObjects.length
    )

    // Berika availability info med vacantFrom baserat på block end date och end date
    vacantRentalObjects.forEach((ps) => {
      if (ps.availabilityInfo) {
        ps.availabilityInfo.vacantFrom = determineVacantFrom(
          ps.availabilityInfo.vacantFrom,
          ps.blockStartDate,
          ps.blockEndDate
        )
      }
    })

    ctx.status = 200
    ctx.body = { content: vacantRentalObjects, ...metadata }
  })

  /**
   * @swagger
   * /rental-objects/by-code/{rentalObjectCode}/availability:
   *   get:
   *     summary: Get a rental object availability by code
   *     description: Fetches a rental object availability by Rental Object Code.
   *     tags:
   *       - RentalObject
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object availability.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 availability:
   *                   type: number
   *       '500':
   *         description: Internal server error. Failed to fetch rental object availability.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *       '404':
   *         description: Not found. The availability of the specified rental object was not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   */
  router.get(
    '/rental-objects/by-code/:rentalObjectCode/availability',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const rentalObjectCode = ctx.params.rentalObjectCode

      // Get parking space by rental object code from xpand to be able to determine
      // vacantFrom based on block end date and end date of last active lease
      const parkingSpaceResult =
        await xpandAdapter.getParkingSpace(rentalObjectCode)

      if (
        !parkingSpaceResult.ok &&
        parkingSpaceResult.err != 'parking-space-not-found'
      ) {
        ctx.status = 500
        ctx.body = {
          error: `An error occurred while fetching parking space by rental object code: ${rentalObjectCode}`,
          ...metadata,
        }
        return
      }

      const parkingSpace = parkingSpaceResult.ok
        ? parkingSpaceResult.data
        : null

      // Get availability info for the parking space from tenfast
      const availabilityResult =
        await tenfastAdapter.getAvailabilityForRentalObject(
          rentalObjectCode,
          false
        )

      if (availabilityResult.ok) {
        if (availabilityResult.data) {
          if (parkingSpace) {
            // Enrich availability info with vacantFrom based on block end date and end date of last active lease
            availabilityResult.data.vacantFrom = determineVacantFrom(
              availabilityResult.data.vacantFrom,
              parkingSpace?.blockStartDate,
              parkingSpace?.blockEndDate
            )
          } //Set VacantFrom to undefined for rental objects that is not parking spaces sincewe don't have block info for those rental objects to be able to determine vacantFrom
          else availabilityResult.data.vacantFrom = undefined
        }

        ctx.status = 200
        ctx.body = {
          content: availabilityResult.data,
          ...metadata,
        }
        return
      }

      if (availabilityResult.err == 'could-not-find-rental-object') {
        ctx.status = 404
        ctx.body = {
          error: `Availability not found for rental object code: ${rentalObjectCode}`,
          ...metadata,
        }
        return
      }

      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching rental object availability.',
        ...metadata,
      }
    }
  )

  /**
   * @swagger
   * /rental-objects/availability:
   *   post:
   *     summary: Get availability for rental objects
   *     description: Fetches availability for rental objects by Rental Object Codes.
   *     tags:
   *       - Lease service
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               rentalObjectCodes:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of rental object codes to include.
   *                 example: ["ABC123", "DEF456", "GHI789"]
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object availability.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 availability:
   *                   type: number
   *       '500':
   *         description: Internal server error. Failed to fetch rental object.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *       '404':
   *         description: Not found. The rent of the specified rental object was not found.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   description: The error message.
   *     security:
   *       - bearerAuth: []
   */
  const RentalObjectsRentRequestSchema = z.object({
    rentalObjectCodes: z.array(z.string()).optional(),
  })
  router.post(
    '/rental-objects/availabilities',
    parseRequestBody(RentalObjectsRentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const body = ctx.request
        .body as typeof RentalObjectsRentRequestSchema._type

      const includeRentalObjectCodes = body.rentalObjectCodes ?? []

      // Get both parking space info from xpand and availability info from tenfast in parallel
      const [parkingSpaceResult, rentalObjectAvailabilitiesResponse] =
        await Promise.all([
          xpandAdapter.getParkingSpaces(includeRentalObjectCodes),
          tenfastAdapter.getRentalObjectAvailabilityInfo(
            includeRentalObjectCodes,
            false
          ),
        ])

      if (
        !parkingSpaceResult.ok &&
        parkingSpaceResult.err !== 'parking-spaces-not-found'
      ) {
        ctx.status = 500
        ctx.body = {
          error: 'An error occurred while fetching parking spaces.',
          ...metadata,
        }
        return
      }

      if (!rentalObjectAvailabilitiesResponse.ok) {
        logger.error(
          { err: rentalObjectAvailabilitiesResponse.err },
          'Error fetching availability for rental objects:'
        )
        ctx.status = 500
        ctx.body = {
          error:
            'An error occurred while fetching availability for rental objects.',
          ...metadata,
        }
        return
      }

      rentalObjectAvailabilitiesResponse.data.forEach((availabilityInfo) => {
        const parkingSpace =
          parkingSpaceResult.ok &&
          parkingSpaceResult.data.find(
            (ps) => ps.rentalObjectCode === availabilityInfo.rentalObjectCode
          )

        // Match availability info to rental object and enrich availability info with
        // vacantFrom based on block end date and end date of last active lease
        if (parkingSpace) {
          availabilityInfo.vacantFrom = determineVacantFrom(
            availabilityInfo.vacantFrom,
            parkingSpace.blockStartDate,
            parkingSpace.blockEndDate
          )
        } // Set VacantFrom to undefined for rental objects that is not parking spaces since we don't have block info for those rental objects to be able to determine vacantFrom
        else availabilityInfo.vacantFrom = undefined
      })

      ctx.status = 200
      ctx.body = {
        content: rentalObjectAvailabilitiesResponse.data,
        ...metadata,
      }
    }
  )
}
