import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import {
  Contact,
  Lease,
  LeaseWithContactAndRentalObjectInfoSchema,
  leasing,
  schemas,
  LeaseStatus,
} from '@onecore/types'
import z from 'zod'

import {
  GetLeaseOptionsSchema,
  GetLeasesOptionsSchema,
  mapLease,
} from './schemas/lease'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import * as propertyManagementAdapter from '../../adapters/property-management-adapter'
import { getHomeInsuranceOfferMonthlyAmount } from './helpers/lease'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import { AdapterResult } from '@/adapters/types'

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /leases/search:
   *   get:
   *     summary: Search and filter leases
   *     tags:
   *       - Lease service
   *     description: Search leases with comprehensive filtering options including text search, object type, status, date ranges, and property hierarchy filters.
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Free-text search (contract ID, tenant name, PNR, contact code, address)
   *       - in: query
   *         name: objectType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Object types (e.g., residence, parking))
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: ['0', '1', '2', '3']
   *         description: Contract status filter (0=Current, 1=Upcoming, 2=AboutToEnd, 3=Ended)
   *       - in: query
   *         name: startDateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Minimum start date (YYYY-MM-DD)
   *       - in: query
   *         name: startDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum start date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateFrom
   *         schema:
   *           type: string
   *           format: date
   *         description: Minimum end date (YYYY-MM-DD)
   *       - in: query
   *         name: endDateTo
   *         schema:
   *           type: string
   *           format: date
   *         description: Maximum end date (YYYY-MM-DD)
   *       - in: query
   *         name: property
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Property/estate names
   *       - in: query
   *         name: buildingCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Building codes
   *       - in: query
   *         name: areaCodes
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Area codes (Område)
   *       - in: query
   *         name: districtNames
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: District names
   *       - in: query
   *         name: buildingManager
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Building manager names (Kvartersvärd)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *           maximum: 100
   *         description: Items per page
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseStartDate, lastDebitDate, leaseId]
   *         description: Sort field
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort direction
   *     responses:
   *       '200':
   *         description: Successfully retrieved lease search results with pagination
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/LeaseSearchResult'
   *                 _meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *                 _links:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PaginationLinks'
   *       '400':
   *         description: Invalid query parameters
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  // TODO: Move move to new microservice governingn organization. for now here just to make it available for the filter in /leases
  /**
   * @swagger
   * /leases/building-managers:
   *   get:
   *     summary: Get all building managers
   *     tags: [Leases]
   *     description: Returns a list of all building managers (Kvartersvärd) with their code, name and district.
   *     responses:
   *       '200':
   *         description: List of building managers
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       code:
   *                         type: string
   *                       name:
   *                         type: string
   *                       district:
   *                         type: string
   *       '500':
   *         description: Internal server error
   */
  router.get('/leases/building-managers', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await leasingAdapter.getBuildingManagers()
      ctx.status = 200
      ctx.body = { content: result, ...metadata }
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error fetching building managers')
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred fetching building managers',
        ...metadata,
      }
    }
  })

  router.get('/leases/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await leasingAdapter.searchLeases(ctx.query)

      ctx.status = 200
      ctx.body = result
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error searching leases')
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during lease search',
        ...metadata,
      }
    }
  })

  router.get('/leases/upcoming-moveins', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    //ska vi ens ta några sökparametrar? Ska kollas med Aktivbo
    const queryParams = leasing.v1.LeaseSearchQueryParamsSchema.safeParse(
      ctx.query
    )

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        details: queryParams.error.issues,
        ...metadata,
      }
      return
    }

    try {
      const leaseSearchParams = {
        ...ctx.query,
        objectType: 'bostad',
        status: LeaseStatus[LeaseStatus.Current],
        startDateFrom: new Date(
          Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0)
        ).toISOString(),
        startDateTo: new Date(
          Date.UTC(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          )
        ).toISOString(),
      }
      console.log('leaseSearchParams', leaseSearchParams)

      const leaseSearchResult =
        await leasingAdapter.searchLeases(leaseSearchParams)

      console.log('leaseSearchResult', leaseSearchResult)

      if (
        !leaseSearchResult.content ||
        leaseSearchResult.content.length === 0
      ) {
        ctx.status = 200
        ctx.body = {
          content: [],
          ...metadata,
        }
        return
      }

      console.log('leaseSearchResult.content[0]', leaseSearchResult.content[0])

      console.log(
        'Lease result before filters',
        leaseSearchResult.content.length
      )

      let gotIt = false

      // Hämta contact och rental object för varje lease innan mappning
      const parsedContent = await Promise.all(
        leaseSearchResult.content.map(async (lease: any) => {
          const rentalObjectCode =
            lease.leaseId.split('/')[0] != ''
              ? lease.leaseId.split('/')[0]
              : lease.leaseId.substring(0, lease.leaseId.lastIndexOf('-'))

          // console.log('lease', lease)

          // Hämta kontaktinfo
          const contactResult = await leasingAdapter.getContactByContactCode(
            lease.contacts[0].contactCode
          )
          if (!contactResult.ok) {
            logger.error(
              {
                status: contactResult.statusCode,
                error: contactResult.err,
                contactCode: lease.contacts[0].contactCode,
              },
              'Failed to fetch contact data'
            )
            return null
          }
          if (!contactResult.data) {
            logger.warn(
              {
                contactCode: lease.contacts[0].contactCode,
              },
              'No contact data found'
            )
            return null
          }

          const contactData = contactResult.data

          console.log('contactData', contactData)

          let rentalPropertyResult =
            await propertyManagementAdapter.getRentalPropertyInfoFromXpand(
              rentalObjectCode
            )
          if (rentalPropertyResult.status != 200) {
            logger.error(
              {
                status: rentalPropertyResult.status,
                data: rentalPropertyResult.data,
                rentalObjectCode,
              },
              'Failed to fetch rental property data'
            )
            return null
          }
          if (!rentalPropertyResult.data) {
            logger.warn(
              {
                rentalObjectCode,
              },
              'No rental property data found'
            )
            return null
          }

          const rentalObjectData = rentalPropertyResult.data

          if (!gotIt) console.log('rentalPropertyResult', rentalPropertyResult)
          gotIt = true

          //filtrera bort property.rentalTypeCode != STD && 55PLUS
          if (
            rentalObjectData.property.rentalTypeCode != 'STD' &&
            rentalObjectData.property.rentalTypeCode != '55PLUS'
          )
            return null

          //filtrera bort fastighetsbeteckningar: KOLAREN 1, KOLMILAN 1, BERGATROLLET 1, KÅRE 5, MALUNG VÄSTRA SÄLEN 7:203
          if (
            rentalObjectData.property.estate === 'KOLAREN 1' ||
            rentalObjectData.property.estate === 'KOLMILAN 1' ||
            rentalObjectData.property.estate === 'BERGATROLLET 1' ||
            rentalObjectData.property.estate === 'KÅRE 5' ||
            rentalObjectData.property.estate === 'MALUNG VÄSTRA SÄLEN 7:203'
          )
            return null

          //filtrera bort de med skyddade personuppgifter
          if (contactData.protectedIdentity) return null

          //filtrera bort Hyresgäst.Avliden är tom/false
          if (contactData.deceased) return null

          //TODO: filtrera bort Avtal.Debitering != Extern
          //TODO: filtrera bort Avtal.Fritext är Direktflytt pga rot

          const mappedLease = {
            leaseId: lease.leaseId,
            fromDate: lease.startDate ? new Date(lease.startDate) : undefined,
            leaseAddress: lease.address,
            contact: {
              contactCode: contactData.contactCode,
              name:
                contactData.fullName ||
                contactData.firstName + ' ' + contactData.lastName,
              email: contactData.emailAddress,
              phoneNumber:
                contactData.phoneNumbers?.find(
                  (number: any) => number.isMainNumber
                )?.phoneNumber ?? '',
              address: contactData.address?.street,
              zipCode: contactData.address?.postalCode,
              city: contactData.address?.city,
            },
            rentalObjectInfo: {
              rentalObjectCode: rentalObjectData.id,
              districtCode: rentalObjectData.districtCode,
              estate: rentalObjectData.property.estate,
              building: rentalObjectData.property.building,
              district: rentalObjectData.district,
            },
          }

          const parseResult =
            LeaseWithContactAndRentalObjectInfoSchema.safeParse(mappedLease)
          if (parseResult.success) {
            return parseResult.data
          } else {
            logger.warn(
              { issues: parseResult.error.issues, lease },
              'Lease validation failed'
            )
            return null
          }
        })
      )

      ctx.status = 200
      ctx.body = { content: parsedContent.filter(Boolean), ...metadata }
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error searching leases')
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during lease search',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /leases/by-rental-object-code/{rentalObjectCode}:
   *   get:
   *     summary: Get leases with related entities for a specific rental object code.
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified rental property id.
   *     parameters:
   *       - in: path
   *         name: rentalObjectCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Rental object code of the building/residence to fetch leases for.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Comma-separated list of statuses to filter by. Valid values are current, upcoming, about-to-end, ended. Default is all statuses.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include contact information in the response
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Lease'
   *       '400':
   *         description: Invalid query parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-rental-object-code/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const queryParams = GetLeasesOptionsSchema.safeParse(ctx.query)

    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        reason: 'Invalid query parameters',
        error: queryParams.error,
        ...metadata,
      }

      return
    }

    try {
      const leases = await leasingAdapter.getLeasesByRentalObjectCode(
        ctx.params.rentalObjectCode,
        queryParams.data
      )

      if (!queryParams.data.includeContacts) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(leases.map(mapLease), metadata)
        return
      }

      const patchedLeases = await patchLeasesWithContacts(leases)

      if (!patchedLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchedLeases.err,
          ...metadata,
        }

        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        patchedLeases.data.map(mapLease),
        metadata
      )
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching leases from leasing')
      ctx.status = 500
    }
  })

  /**
   * @swagger
   * /leases/by-pnr/{pnr}:
   *   get:
   *     summary: Get leases with related entities for a specific Personal Number (PNR)
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified Personal Number (PNR).
   *     parameters:
   *       - in: path
   *         name: pnr
   *         required: true
   *         schema:
   *           type: string
   *         description: Personal Number (PNR) of the individual to fetch leases for.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Comma-separated list of statuses to filter by. Valid values are current, upcoming, about-to-end, ended. Default is all statuses.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include contact information in the response
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Lease'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-pnr/:pnr', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const queryParams = GetLeasesOptionsSchema.safeParse(ctx.query)
    if (!queryParams.success) {
      ctx.status = 400
      ctx.body = {
        error: queryParams.error,
        ...metadata,
      }
      return
    }

    try {
      const contact = await leasingAdapter.getContactForPnr(ctx.params.pnr)

      // TODO(BREAKING): includeContacts no longer defaults to true
      const leases = await leasingAdapter.getLeasesByContactCode(
        contact.contactCode,
        queryParams.data
      )

      if (!queryParams.data.includeContacts) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(leases.map(mapLease), metadata)
        return
      }

      const patchedLeases = await patchLeasesWithContacts(leases)
      if (!patchedLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchedLeases.err,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        patchedLeases.data.map(mapLease),
        metadata
      )
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching leases from leasing')
      ctx.status = 500
    }
  })

  /**
   * @swagger
   * /leases/by-contact-code/{contactCode}:
   *   get:
   *     summary: Get leases with related entities for a specific contact code
   *     tags:
   *       - Lease service
   *     description: Retrieves lease information along with related entities (such as tenants, properties, etc.) for the specified contact code.
   *     parameters:
   *       - in: path
   *         name: contactCode
   *         required: true
   *         schema:
   *           type: string
   *         description: Contact code of the individual to fetch leases for.
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Comma-separated list of statuses to filter by. Valid values are current, upcoming, about-to-end, ended. Default is all statuses.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include contact information in the response
   *     responses:
   *       '200':
   *         description: Successful response with leases and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Lease'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/by-contact-code/:contactCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const queryParams = GetLeasesOptionsSchema.safeParse(ctx.query)

      if (!queryParams.success) {
        ctx.status = 400
        ctx.body = {
          reason: 'Invalid query parameters',
          error: queryParams.error,
          ...metadata,
        }
        return
      }

      const leases = await leasingAdapter.getLeasesByContactCode(
        ctx.params.contactCode,
        queryParams.data
      )

      if (!queryParams.data.includeContacts) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(leases.map(mapLease), metadata)
        return
      }

      const patchedLeases = await patchLeasesWithContacts(leases)
      if (!patchedLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchedLeases.err,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(
        patchedLeases.data.map(mapLease),
        metadata
      )
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching leases from leasing')
      ctx.status = 500
      ctx.body = {
        error: 'Internal server error',
        ...metadata,
      }
    }
  })

  async function patchLeasesWithContacts(
    leases: Lease[]
  ): Promise<AdapterResult<Lease[], 'no-contact' | 'unknown'>> {
    for (const lease of leases) {
      if (!lease.tenantContactIds) {
        continue
      }

      let contacts: Contact[] = []
      for (const contactCode of lease.tenantContactIds) {
        const contact =
          await leasingAdapter.getContactByContactCode(contactCode)
        if (!contact.ok || !contact.data) {
          return { ok: false, err: 'no-contact' }
        }

        contacts.push(contact.data)
      }

      lease.tenants = contacts
    }

    return { ok: true, data: leases }
  }

  /**
   * @swagger
   * /leases/{id}:
   *   get:
   *     summary: Get lease by ID
   *     tags:
   *       - Lease service
   *     description: Retrieves lease details along with related entities based on the provided ID.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease to retrieve.
   *       - in: query
   *         name: includeContacts
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Whether to include contact information in the response
   *     responses:
   *       '200':
   *         description: Successful response with the requested lease and related entities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const queryParams = GetLeaseOptionsSchema.safeParse(ctx.query)

      if (!queryParams.success) {
        ctx.status = 400
        ctx.body = {
          reason: 'Invalid query parameters',
          error: queryParams.error,
          ...metadata,
        }
        return
      }

      const lease = await leasingAdapter.getLease(ctx.params.id)

      if (!lease) {
        ctx.status = 404
        return
      }

      if (!queryParams.data.includeContacts) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(mapLease(lease), metadata)
        return
      }

      if (!lease.tenantContactIds) {
        logger.error(
          { metadata, leaseId: lease.leaseId },
          'Lease has no tenant contact IDs'
        )
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(mapLease(lease), metadata)
        return
      }

      const patchedLease = await patchLeasesWithContacts([lease])

      if (!patchedLease.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchedLease.err,
          ...metadata,
        }
        return
      }

      const [leaseWithContacts] = patchedLease.data
      ctx.status = 200
      ctx.body = makeSuccessResponseBody(mapLease(leaseWithContacts), metadata)
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching lease')
      ctx.status = 500
      ctx.body = {
        error: 'Internal server error',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance:
   *   get:
   *     summary: Get home insurance for a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       200:
   *         description: Home insurance retrieved.
   *       404:
   *         description: Lease or home insurance not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('/leases/:leaseId/home-insurance', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.getLeaseHomeInsurance(
      ctx.params.leaseId
    )

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = {
          error: 'Not found',
          ...metadata,
        }
        return
      }

      ctx.status = 500
      ctx.body = {
        error: result.err,
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody<
      z.infer<typeof schemas.v1.LeaseHomeInsuranceSchema>
    >(result.data, metadata)
  })

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance/offer:
   *   get:
   *     summary: Get home insurance offer for a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       200:
   *         description: Home insurance offer retrieved.
   *       404:
   *         description: Lease or rental object not found.
   *       500:
   *         description: Internal server error.
   */
  router.get('/leases/:leaseId/home-insurance/offer', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const lease = await leasingAdapter.getLease(ctx.params.leaseId)
      if (!lease) {
        ctx.status = 404
        ctx.body = {
          error: 'Lease not found',
          ...metadata,
        }
        return
      }

      const residenceResponse =
        await propertyBaseAdapter.getResidenceByRentalId(lease.rentalPropertyId)

      if (!residenceResponse.ok) {
        if (residenceResponse.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: 'Rental object not found',
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: residenceResponse.err,
          ...metadata,
        }
        return
      }

      const monthlyAmount = getHomeInsuranceOfferMonthlyAmount(
        residenceResponse.data.type.roomCount
      )

      if (!monthlyAmount) {
        throw {
          error: 'No monthly amount found for residence',
          residence: JSON.stringify(residenceResponse.data, null, 2),
        }
      }
      ctx.status = 200
      ctx.body = makeSuccessResponseBody<
        z.infer<typeof schemas.v1.LeaseHomeInsuranceSchema>
      >({ monthlyAmount }, metadata)
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching home insurance offer')
      ctx.status = 500
      ctx.body = {
        error: 'Unknown error',
        ...metadata,
      }
    }
  })

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance:
   *   post:
   *     summary: Add home insurance to a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     responses:
   *       201:
   *         description: Successfully added home insurance.
   *       500:
   *         description: Internal server error.
   */

  const AddLeaseHomeInsuranceRequestSchema = z.object({
    from: z.coerce.date(),
  })

  router.post(
    '/leases/:leaseId/home-insurance',
    parseRequestBody(AddLeaseHomeInsuranceRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      try {
        const lease = await leasingAdapter.getLease(ctx.params.leaseId)

        if (!lease) {
          ctx.status = 404
          ctx.body = {
            error: 'Lease not found',
            ...metadata,
          }

          return
        }

        const residenceResponse =
          await propertyBaseAdapter.getResidenceByRentalId(
            lease.rentalPropertyId
          )

        if (!residenceResponse.ok) {
          if (residenceResponse.err === 'not-found') {
            ctx.status = 404
            ctx.body = {
              error: 'Rental object not found',
              ...metadata,
            }
            return
          } else {
            ctx.logger.error(
              { err: residenceResponse.err, metadata },
              'Error fetching residence'
            )
            ctx.status = 500
            ctx.body = {
              error: 'Internal error',
              ...metadata,
            }

            return
          }
        }

        const monthlyAmount = getHomeInsuranceOfferMonthlyAmount(
          residenceResponse.data.type.roomCount
        )

        if (!monthlyAmount) {
          throw {
            error: 'No monthly amount found for residence',
            residence: JSON.stringify(residenceResponse.data, null, 2),
          }
        }

        const result = await leasingAdapter.addLeaseHomeInsurance(
          ctx.params.leaseId,
          { from: ctx.request.body.from, monthlyAmount }
        )

        if (!result.ok) {
          if (result.err === 'not-found') {
            ctx.status = 404
            ctx.body = {
              error: 'Lease not found',
              ...metadata,
            }
            return
          }

          if (result.err === 'insurance-already-exists') {
            ctx.status = 422
            ctx.body = {
              error: 'Home insurance already exists',
              ...metadata,
            }
            return
          }

          ctx.status = 500
          ctx.body = {
            error: result.err,
            ...metadata,
          }
          return
        }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(null, metadata)
      } catch (err) {
        logger.error({ err, metadata }, 'Error adding home insurance')
        ctx.status = 500
        ctx.body = {
          error: 'Internal error',
          ...metadata,
        }

        return
      }
    }
  )

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance/cancel:
   *   post:
   *     summary: Cancel home insurance for a lease
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - endDate
   *             properties:
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 description: Desired end date for home insurance.
   *     responses:
   *       200:
   *         description: Home insurance cancelled.
   *       500:
   *         description: Internal server error.
   */
  router.post(
    '/leases/:leaseId/home-insurance/cancel',
    parseRequestBody(leasing.v1.CancelLeaseHomeInsuranceRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const lease = await leasingAdapter.getLease(ctx.params.leaseId)

      if (!lease) {
        ctx.status = 404
        ctx.body = {
          error: 'Lease not found',
          ...metadata,
        }
        return
      }

      const homeInsurance = await leasingAdapter.getLeaseHomeInsurance(
        ctx.params.leaseId
      )

      if (!homeInsurance.ok) {
        if (homeInsurance.err === 'not-found') {
          ctx.status = 404
          ctx.body = {
            error: 'Home insurance not found',
            ...metadata,
          }
          return
        }

        ctx.status = 500
        ctx.body = {
          error: homeInsurance.err,
          ...metadata,
        }
        return
      }

      if (!homeInsurance.data) {
        ctx.status = 404
        ctx.body = {
          error: 'Home insurance not found',
          ...metadata,
        }
        return
      }

      const cancelLeaseHomeInsuranceResult =
        await leasingAdapter.cancelLeaseHomeInsurance(ctx.params.leaseId, {
          endDate: ctx.request.body.endDate,
        })

      if (!cancelLeaseHomeInsuranceResult.ok) {
        ctx.status = 500
        ctx.body = {
          error: cancelLeaseHomeInsuranceResult.err,
          ...metadata,
        }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(null, metadata)
    }
  )
}
