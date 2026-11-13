import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import * as xpandAdapter from '../adapters/xpand/rental-object-adapter'

import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { leasing, RentalObjectAvailabilityInfo } from '@onecore/types'
import {
  determineVacantFrom,
  hasIndefiniteActiveBlock,
  withRentAt,
} from '../helpers/rental-object-availability-helpers'
import { mapToOnecoreRentalObjectRent } from '../helpers/tenfast'
import listingTextContentAdapter from '../adapters/listing-text-content-adapter'

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
      { includeRentalObjectCodes?: string[] } | undefined
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

    const availabilityByCode = new Map(
      rentalObjectAvailabilitiesResponse.data.map((availability) => [
        availability.rentalObjectCode,
        availability,
      ])
    )

    parkingSpaceResult.data.forEach((ps) => {
      const availability = availabilityByCode.get(ps.rentalObjectCode)

      // Match availability info to rental object and enrich availability info with
      // vacantFrom based on block end date and end date of last active lease
      if (availability) {
        const vacantFrom = determineVacantFrom(
          availability.vacantFrom,
          ps.blockStartDate,
          ps.blockEndDate
        )
        ps.availabilityInfo = withRentAt(
          { ...availability, vacantFrom },
          vacantFrom
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
        const vacantFrom = determineVacantFrom(
          availabilityResult.data.vacantFrom,
          result.data.blockStartDate,
          result.data.blockEndDate
        )

        ctx.status = 200
        ctx.body = {
          content: {
            ...result.data,
            availabilityInfo: withRentAt(
              { ...availabilityResult.data, vacantFrom },
              vacantFrom
            ),
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
   *     description: |
   *       Fetches a list of all vacant parking spaces available in the system.
   *       Each parking space carries hasListingTextContent, telling whether
   *       listing text content exists for it. The flag is omitted if the
   *       text content lookup fails.
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
    logger.info('Fetching all vacant parking spaces')

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

    // Match availability info to rental objects
    rentalObjectResult.data.forEach((ps) => {
      ps.availabilityInfo = availabilityResult.data?.find(
        (availability: RentalObjectAvailabilityInfo) =>
          availability.rentalObjectCode === ps.rentalObjectCode
      )
    })

    // Filter out parking spaces with an indefinite (no end date) active block —
    // a block with an end date is still listed, with vacantFrom computed below.
    const vacantRentalObjects = rentalObjectResult.data.filter(
      (ps) => !hasIndefiniteActiveBlock(ps)
    )

    // Berika availability info med vacantFrom baserat på block end date och end date
    vacantRentalObjects.forEach((ps) => {
      if (ps.availabilityInfo) {
        const vacantFrom = determineVacantFrom(
          ps.availabilityInfo.vacantFrom,
          ps.blockStartDate,
          ps.blockEndDate
        )
        ps.availabilityInfo = withRentAt(
          { ...ps.availabilityInfo, vacantFrom },
          vacantFrom
        )
      }
    })

    // The text content flag is attached here from the leasing DB. If that
    // lookup fails the list is still returned, without the flag, since it
    // only drives an icon.
    const textContentCodes =
      await listingTextContentAdapter.getRentalObjectCodesWithTextContent(
        vacantRentalObjects.map((parkingSpace) => parkingSpace.rentalObjectCode)
      )
    const codesWithTextContent = textContentCodes.ok
      ? new Set(textContentCodes.data)
      : undefined
    const content = codesWithTextContent
      ? vacantRentalObjects.map((parkingSpace) => ({
          ...parkingSpace,
          hasListingTextContent: codesWithTextContent.has(
            parkingSpace.rentalObjectCode
          ),
        }))
      : vacantRentalObjects
    ctx.status = 200
    ctx.body = { content, ...metadata }
  })

  /**
   * @swagger
   * /rental-objects/by-code/{rentalObjectCode}/availability:
   *   get:
   *     summary: Get a rental object availability by code
   *     description: |
   *       Fetches a rental object availability by Rental Object Code.
   *       The rent total (rent.amount, rent.vat) is the rent of today, unless
   *       a later move-in day is known. For a parking space that day is its
   *       vacantFrom. For other rental objects vacantFrom is not set, so the
   *       caller gives the day as rentAt. The total is then the sum of the
   *       rent rows in force that day with includedInRent set.
   *     tags:
   *       - RentalObject
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code of the availability to fetch.
   *       - in: query
   *         name: rentAt
   *         required: false
   *         schema:
   *           type: string
   *           format: date
   *         description: |
   *           The day to give the rent total for (yyyy-mm-dd), for rental
   *           objects that are not parking spaces. Left out, today or earlier
   *           gives the rent of today. Ignored for parking spaces.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object availability.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     rentalObjectCode:
   *                       type: string
   *                     vacantFrom:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                     rent:
   *                       type: object
   *                       properties:
   *                         amount:
   *                           type: number
   *                         vat:
   *                           type: number
   *                         asOf:
   *                           type: string
   *                           format: date-time
   *                           description: |
   *                             The day the total (amount, vat) is the rent of.
   *                             Today when the total was not recalculated for
   *                             the move-in day, which also happens when the
   *                             rows for that day look incomplete.
   *                         rows:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               code:
   *                                 type: string
   *                               description:
   *                                 type: string
   *                               amount:
   *                                 type: number
   *                               vatPercentage:
   *                                 type: number
   *                               fromDate:
   *                                 type: string
   *                                 format: date-time
   *                                 nullable: true
   *                               toDate:
   *                                 type: string
   *                                 format: date-time
   *                                 nullable: true
   *                               includedInRent:
   *                                 type: boolean
   *                                 description: False for a row that is not part of the rent total, such as an optional add-on.
   *       '400':
   *         description: rentAt is not a valid day (error invalid-rent-at).
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   enum: [invalid-rent-at]
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

      const query = leasing.v1.RentalObjectAvailabilityQuerySchema.safeParse(
        ctx.query
      )
      if (!query.success) {
        ctx.status = 400
        ctx.body = { error: 'invalid-rent-at', ...metadata }
        return
      }
      const rentAt = query.data.rentAt ? new Date(query.data.rentAt) : undefined

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
        // For a parking space, vacantFrom is based on block end date and end
        // date of last active lease. For other rental objects it is left
        // undefined, since we have no block info to determine it from.
        const vacantFrom = parkingSpace
          ? determineVacantFrom(
              availabilityResult.data.vacantFrom,
              parkingSpace.blockStartDate,
              parkingSpace.blockEndDate
            )
          : undefined

        ctx.status = 200
        ctx.body = {
          content: withRentAt(
            { ...availabilityResult.data, vacantFrom },
            // The move-in day: our own for a parking space, the caller's for
            // other rental objects.
            parkingSpace ? vacantFrom : rentAt
          ),
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
   * /rental-objects/by-code/{rentalObjectCode}/rent:
   *   get:
   *     summary: Get rent for a rental object
   *     description: Fetches the rental object's configured rent from Tenfast, independent of any lease. Works for vacant objects.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to fetch rent for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the rental object rent.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     rentalObjectCode:
   *                       type: string
   *                     rent:
   *                       type: object
   *                       properties:
   *                         amount:
   *                           type: number
   *                         vat:
   *                           type: number
   *                         rows:
   *                           type: array
   *                           items:
   *                             type: object
   *       '404':
   *         description: Not found. The specified rental object was not found in Tenfast.
   *       '500':
   *         description: Internal server error. Failed to fetch rental object rent.
   */
  router.get('/rental-objects/by-code/:rentalObjectCode/rent', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const rentalObjectCode = ctx.params.rentalObjectCode

    const result = await tenfastAdapter.getRentalObject(rentalObjectCode)

    if (!result.ok) {
      ctx.status = 500
      ctx.body = { error: result.err, ...metadata }
      return
    }

    if (!result.data) {
      ctx.status = 404
      ctx.body = {
        error: `Rental object not found: ${rentalObjectCode}`,
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = {
      content: {
        rentalObjectCode: result.data.externalId,
        rent: mapToOnecoreRentalObjectRent(result.data),
      },
      ...metadata,
    }
  })

  /**
   * @swagger
   * /rental-objects/by-code/{rentalObjectCode}/rent-legacy:
   *   get:
   *     summary: Get legacy (Xpand) rent for a rental object
   *     description: Fetches the rental object's rent rows from Xpand's debit row view, converted to monthly amounts. Used to compare against Tenfast during the transition.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental object code to fetch legacy rent for.
   *     responses:
   *       '200':
   *         description: Successfully retrieved the legacy rental object rent.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: object
   *                   properties:
   *                     rentalObjectCode:
   *                       type: string
   *                     rent:
   *                       type: object
   *                       properties:
   *                         amount:
   *                           type: number
   *                         vat:
   *                           type: number
   *                         rows:
   *                           type: array
   *                           items:
   *                             type: object
   *       '404':
   *         description: Not found. No rent rows exist in Xpand for the specified rental object.
   *       '500':
   *         description: Internal server error. Failed to fetch legacy rental object rent.
   */
  router.get(
    '/rental-objects/by-code/:rentalObjectCode/rent-legacy',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const rentalObjectCode = ctx.params.rentalObjectCode

      const result =
        await xpandAdapter.getRentalObjectRentRows(rentalObjectCode)

      if (!result.ok && result.err === 'not-found') {
        ctx.status = 404
        ctx.body = {
          error: `No rent rows found in Xpand for rental object: ${rentalObjectCode}`,
          ...metadata,
        }
        return
      }

      if (!result.ok) {
        ctx.status = 500
        ctx.body = { error: result.err, ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = {
        content: { rentalObjectCode, rent: result.data },
        ...metadata,
      }
    }
  )

  /**
   * @swagger
   * /rental-objects/availability:
   *   post:
   *     summary: Get availability for rental objects
   *     description: |
   *       Fetches availability for rental objects by Rental Object Codes.
   *       The rent total (rent.amount, rent.vat) is the rent of today, unless
   *       a later move-in day is known. For a parking space that day is its
   *       vacantFrom. For other rental objects vacantFrom is not set, so the
   *       caller gives the day in rentAtByRentalObjectCode. The total is then
   *       the sum of the rent rows in force that day with includedInRent set.
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
   *               rentAtByRentalObjectCode:
   *                 type: object
   *                 additionalProperties:
   *                   type: string
   *                   format: date
   *                 description: |
   *                   The day to give the rent total for (yyyy-mm-dd), per
   *                   rental object code, for rental objects that are not
   *                   parking spaces. A code left out, today or earlier gives
   *                   the rent of today. Ignored for parking spaces. Codes
   *                   are matched without regard to case or surrounding
   *                   blanks. rent.asOf in the response says which day each
   *                   total is the rent of.
   *                 example: { "ABC123": "2027-01-16" }
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
   *       '400':
   *         description: The request body is invalid, such as a rentAtByRentalObjectCode value that is not a valid day.
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
  router.post(
    '/rental-objects/availabilities',
    parseRequestBody(leasing.v1.RentalObjectAvailabilitiesRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      // Parsed by parseRequestBody above; koa's ctx doesn't carry its type.
      const body = ctx.request
        .body as leasing.v1.RentalObjectAvailabilitiesRequest

      const includeRentalObjectCodes = body.rentalObjectCodes ?? []
      // Codes are matched without regard to case or surrounding blanks, so a
      // day isn't dropped over how the caller wrote the code.
      const normalizeCode = (code: string) => code.trim().toUpperCase()
      const rentAtByCode = new Map(
        Object.entries(body.rentAtByRentalObjectCode ?? {}).map(
          ([code, rentAt]) => [normalizeCode(code), new Date(rentAt)]
        )
      )

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

      const parkingSpaceByCode = new Map(
        (parkingSpaceResult.ok ? parkingSpaceResult.data : []).map((ps) => [
          ps.rentalObjectCode,
          ps,
        ])
      )

      const content = rentalObjectAvailabilitiesResponse.data.map(
        (availabilityInfo) => {
          const parkingSpace = parkingSpaceByCode.get(
            availabilityInfo.rentalObjectCode
          )

          // For a parking space, vacantFrom is based on block end date and
          // end date of last active lease, and the rent is the rent that day.
          if (parkingSpace) {
            const vacantFrom = determineVacantFrom(
              availabilityInfo.vacantFrom,
              parkingSpace.blockStartDate,
              parkingSpace.blockEndDate
            )
            return withRentAt({ ...availabilityInfo, vacantFrom }, vacantFrom)
          }

          // For other rental objects vacantFrom is left undefined, since we
          // have no block info to determine it from. The caller gives the
          // move-in day to get the rent for.
          return withRentAt(
            { ...availabilityInfo, vacantFrom: undefined },
            rentAtByCode.get(normalizeCode(availabilityInfo.rentalObjectCode))
          )
        }
      )

      // A day given for a code that no returned rental object has was not
      // applied to anything, which the response can't show.
      const returnedCodes = new Set(
        content.map((availabilityInfo) =>
          normalizeCode(availabilityInfo.rentalObjectCode)
        )
      )
      const unmatchedRentAtCount = [...rentAtByCode.keys()].filter(
        (code) => !returnedCodes.has(code)
      ).length
      if (unmatchedRentAtCount > 0)
        logger.warn(
          { unmatchedRentAtCount, rentAtCount: rentAtByCode.size },
          'rental-objects/availabilities: rentAtByRentalObjectCode has codes that match no returned rental object'
        )

      ctx.status = 200
      ctx.body = { content, ...metadata }
    }
  )
}
