import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import * as xpandAdapter from '../adapters/xpand/rental-object-adapter'

import * as tenfastAdapter from '../adapters/tenfast/tenfast-adapter'
import z from 'zod'
import { parseRequestBody } from '../../../middlewares/parse-request-body'
import { TenfastLease } from '../adapters/tenfast/schemas'

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

    const [parkingSpaceResult, rentalObjectAvailabilitiesResponse] =
      await Promise.all([
        xpandAdapter.getParkingSpaces(includeRentalObjectCodes),
        tenfastAdapter.getRentalObjectAvailabilityInfo(
          includeRentalObjectCodes,
          false
        ),
      ])

    //TODO: Hämta ev sista debiteringsdatum på aktiva avtal från tenfast
    //TODO: Räkna ut VacantFrom baserat på avtalets slutdatum samt eventuella spärrar

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
        'Error fetching rents for parking spaces:'
      )
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching rents for parking spaces.',
        ...metadata,
      }
      return
    }

    parkingSpaceResult.data.forEach((ps) => {
      const availability = rentalObjectAvailabilitiesResponse.data.find(
        (availability) => availability.rentalObjectCode === ps.rentalObjectCode
      )
      if (availability) {
        ps.availabilityInfo = availability
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

    const result = await xpandAdapter.getParkingSpace(rentalObjectCode)

    //TODO: Hämta ev sista debiteringsdatum på aktiva avtal från tenfast
    //TODO: Räkna ut VacantFrom baserat på avtalets slutdatum samt eventuella spärrar

    if (result.ok) {
      //get rental object with rent and lastDebitDate from tenfast
      const availabilityResult =
        await tenfastAdapter.getAvailabilityForRentalObject(
          rentalObjectCode,
          false
        )

      if (availabilityResult.ok) {
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

      //return result without rent
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

    const leasesResult = await tenfastAdapter.getLeases()

    if (!leasesResult.ok) {
      logger.error(
        { err: leasesResult.err },
        'Error fetching leases from tenfast parking spaces:'
      )
      ctx.status = 500
      ctx.body = {
        error:
          'An error occurred while fetching leases from tenfast parking spaces.',
        ...metadata,
      }
      return
    }

    console.log('Antal avtal från tenfast:', leasesResult.data.length)

    const activeRentalObjectCodes = new Set(
      leasesResult.data
        .filter(
          (lease) => !lease.endDate || new Date(lease.endDate) > new Date()
        ) // Avtal utan endDate eller slutdatum i framtiden = aktivt
        .flatMap((lease) => lease.hyresobjekt.map((obj) => obj.externalId)) // eller rentalObjectCode beroende på din struktur
    )

    console.log(
      'Aktiva eller uppsagda hyresobjekt från tenfast: ',
      activeRentalObjectCodes.values.length
    )

    const parkingSpacesWithoutBlocks =
      await xpandAdapter.getAllVacantParkingSpaces()

    if (!parkingSpacesWithoutBlocks.ok) {
      logger.error(
        { err: parkingSpacesWithoutBlocks.err },
        'Error fetching vacant parking spaces:'
      )
      ctx.status = 500
      ctx.body = {
        error: 'An error occurred while fetching vacant parking spaces.',
        ...metadata,
      }
      return
    }

    console.log(
      'Antal parkeringsplatser utan spärrar från xpand:',
      parkingSpacesWithoutBlocks.data.length
    )

    //TODO:Skriv om den här funktionen efter att vi fått en endpoint från Tenfast som hämtar alla lediga hyresobjekt

    const vacantParkingSpaces = parkingSpacesWithoutBlocks.data.filter(
      (ps) => !activeRentalObjectCodes.has(ps.rentalObjectCode)
    )

    console.log(
      'Antal vakanta parkeringsplatser efter filtrering av aktiva avtal:',
      vacantParkingSpaces.length
    )

    const rentalObjectAvailabilityResponse =
      await tenfastAdapter.getRentalObjectAvailabilityInfo(
        vacantParkingSpaces.map((ps) => ps.rentalObjectCode),
        false
      )

    if (!rentalObjectAvailabilityResponse.ok) {
      logger.error(
        { err: rentalObjectAvailabilityResponse.err },
        'Error fetching availability for vacant parking spaces:'
      )
      ctx.status = 500
      ctx.body = {
        error:
          'An error occurred while fetching availability for vacant parking spaces.',
        ...metadata,
      }
      return
    }

    vacantParkingSpaces.forEach((ps) => {
      const availability = rentalObjectAvailabilityResponse.data.find(
        (availability) => availability.rentalObjectCode === ps.rentalObjectCode
      )

      if (availability) {
        ps.availabilityInfo = availability

        const vacantFrom = determineVacantFrom(
          availability?.vacantFrom,
          ps.blockStartDate,
          ps.blockEndDate
        )

        if (vacantFrom) {
          ps.availabilityInfo.vacantFrom = vacantFrom
        }
      }
    })
    ctx.status = 200
    ctx.body = { content: vacantParkingSpaces, ...metadata }
  })

  function determineVacantFrom(
    vacantFromDate?: Date | null,
    blockStartDate?: string | Date | null,
    blockEndDate?: string | Date | null
  ): Date | undefined {
    const toDate = (d: string | Date | undefined | null) =>
      d ? new Date(d) : undefined

    const lastBlockStartDate = toDate(blockStartDate)
    const lastBlockEndDate = toDate(blockEndDate)
    const lastDebit = toDate(vacantFromDate)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    let vacantFrom: Date | undefined

    if (lastBlockEndDate && lastBlockEndDate >= today) {
      vacantFrom = new Date(lastBlockEndDate)
      vacantFrom.setUTCDate(vacantFrom.getUTCDate() + 1)
      vacantFrom.setUTCHours(0, 0, 0, 0)
    } else if (lastBlockStartDate && !lastBlockEndDate) {
      vacantFrom = undefined
    } else if (lastDebit) {
      vacantFrom = new Date(lastDebit)
      vacantFrom.setUTCDate(vacantFrom.getUTCDate() + 1)
      vacantFrom.setUTCHours(0, 0, 0, 0)
    } else {
      vacantFrom = today
    }

    return vacantFrom
  }

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

      const result = await tenfastAdapter.getAvailabilityForRentalObject(
        rentalObjectCode,
        false
      )

      if (result.ok) {
        ctx.status = 200
        ctx.body = { content: result.data, ...metadata }
        return
      }

      if (result.err == 'could-not-find-rental-object') {
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
    '/rental-objects/availability',
    parseRequestBody(RentalObjectsRentRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      const body = ctx.request
        .body as typeof RentalObjectsRentRequestSchema._type

      const result = await tenfastAdapter.getRentalObjectAvailabilityInfo(
        body.rentalObjectCodes ?? [],
        false
      )

      //TODO: also get blocks from rental object to be able to calculate vacantFrom based on end date of last active lease or block end date if there is an active block

      if (!result.ok && result.err === 'could-not-find-rental-objects') {
        ctx.status = 404
        ctx.body = { error: 'Rental objects not found', ...metadata }
        return
      } else if (!result.ok) {
        ctx.status = 500
        ctx.body = {
          error:
            'Unexpected error when getting availability for ' +
            (body.rentalObjectCodes ?? []).join(', '),
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = { content: result.data, ...metadata }
    }
  )
}
