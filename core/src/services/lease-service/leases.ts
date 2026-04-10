import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
} from '@onecore/utilities'
import {
  Contact,
  Lease,
  LeaseWithAdditionalCustomerScoreCardInfoSchema,
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

  /**
   * @swagger
   * /leases/for-CSC:
   *   get:
   *     summary: Get all tenants with info required for Customer Score Card (CSC), including their leases and related entities
   *     tags:
   *       - Lease service
   *     description: Returns a list of residential leases, including contact and rental object info. Filters out protected identities, deceased tenants, and certain property types/estates.
   *     responses:
   *       '200':
   *         description: Successfully retrieved upcoming move-ins
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/LeaseWithAdditionalCustomerScoreCardInfoSchema'
   *                 _meta:
   *                   type: object
   *       '400':
   *         description: Invalid query parameters
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/for-CSC', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const start = Date.now()

    try {
      // Filter leases on object type 'Bostad' and current leases but allow additional filtering by query params, ie for paging
      const leaseSearchParams = {
        limit: '500',
        ...ctx.query,
        objectType: 'bostad',
        status: LeaseStatus[LeaseStatus.Current],
      }

      // Set limit to max 500
      if (Number(leaseSearchParams.limit) > 500) leaseSearchParams.limit = '500'

      const leaseSearchResult =
        await leasingAdapter.searchLeases(leaseSearchParams)

      let log = `Avtals-sök tid: ${Date.now() - start}ms`

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

      // console.log('Lease search result:', leaseSearchResult)
      //Get contact and rental object info for each lease, and filter out protected identities, deceased tenants, and certain property types/estates
      const parsedContent = await Promise.all(
        leaseSearchResult.content.map(
          async (lease: leasing.v1.LeaseSearchResult) => {
            const rentalObjectCode =
              lease.leaseId.split('/')[0] != ''
                ? lease.leaseId.split('/')[0]
                : lease.leaseId.substring(0, lease.leaseId.lastIndexOf('-'))

            const [contactResult, rentalPropertyResult] = await Promise.all([
              leasingAdapter.getContactByContactCode(
                lease.contacts[0].contactCode
              ),
              propertyManagementAdapter.getRentalPropertyInfoFromXpand(
                rentalObjectCode
              ),
            ])

            if (!contactResult.ok) {
              logger.error(
                {
                  status: contactResult.statusCode,
                  error: contactResult.err,
                  contactCode: lease.contacts[0]?.contactCode,
                },
                'Failed to fetch contact data'
              )
              return null
            }
            if (!contactResult.data) {
              logger.warn(
                {
                  contactCode: lease.contacts[0]?.contactCode,
                },
                'No contact data found'
              )
              return null
            }

            const tenant = contactResult.data

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

            // console.log('rentalObjectData', rentalObjectData)

            //Filter out leases for contacts with protected identity.
            if (tenant.protectedIdentity) return null

            //Filter out leases for deceased contacts.
            if (tenant.deceased) return null

            //Filter out leases for customers that are companies (contact code does not start with P).
            if (!tenant.contactCode.startsWith('P')) return null

            //Filter out rental objects that are created for testing purposes in XPand (rental object codes starting with 000-000)
            if (rentalObjectData.id.startsWith('000-000')) return null

            const mappedLease = {
              //lease info
              division_1038: lease.leaseId,
              //division_1037: lease.contractDate How to get contractDate?
              //  ? new Date(lease.contractDate)
              //  : undefined,
              contract_start_date: lease.startDate
                ? new Date(lease.startDate)
                : undefined,
              // contract_end_date: lease.endDate How to get endDate?
              //   ? new Date(lease.endDate)
              //   : undefined,
              object_street_1: lease.address,
              object_zip: lease.postalCode,
              object_city: lease.city,
              //contact ifo
              division_1501: tenant.contactCode,
              respondent_name_first: tenant.firstName,
              respondent_name_last: tenant.lastName,
              respondent_email: tenant.emailAddress,
              respondent_phone:
                tenant.phoneNumbers?.find((number: any) => number.isMainNumber)
                  ?.phoneNumber ?? '',
              postal_street_1: tenant.address?.street,
              postal_street_2: tenant.address?.street2 ?? undefined,
              postal_zip: tenant.address?.postalCode,
              postal_city: tenant.address?.city,
              //rental object info
              object_ref_nr: rentalObjectData.id,
              division_1011: rentalObjectData.districtCode,
              object_real_estate: rentalObjectData.property.estate,
              object_real_estate_year_construction:
                rentalObjectData.building.constructionYear ?? undefined,
              object_real_estate_year_reconstruction:
                rentalObjectData.building.renovationYear ?? undefined,
              real_estate_type: rentalObjectData.building.buildingTypeCaption,
              division_1048: rentalObjectData.district,
              division_1242: rentalObjectData.marketArea,
              rentalTypeCode: rentalObjectData.property.rentalTypeCode,
            }

            // console.log('mappedLease', mappedLease)

            const parseResult =
              LeaseWithAdditionalCustomerScoreCardInfoSchema.safeParse(
                mappedLease
              )
            if (parseResult.success) {
              // console.log(
              //   'Parsed lease with contact and rental object info:',
              //   parseResult.data
              // )
              return parseResult.data
            } else {
              logger.warn(
                { issues: parseResult.error.issues, lease },
                'Lease validation failed'
              )
              return null
            }
          }
        )
      )

      console.log(log)
      console.log(`Contacts och property info tid: ${Date.now() - start}ms`)

      // console.log('Lease search result:', leaseSearchResult.content.length)
      // console.log('Parsed content:', parsedContent.length)

      const filteredLeases = parsedContent.filter(Boolean)

      ctx.status = 200
      ctx.body = {
        content: filteredLeases,
        _meta: {
          ...leaseSearchResult._meta,
          count: filteredLeases.length,
        },

        ...metadata,
      }
    } catch (error: unknown) {
      logger.error({ error, metadata }, 'Error getting leases for CSC report')
      ctx.status = 500
      ctx.body = {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while fetching leases for CSC report',
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

  /**
   * @swagger
   * /leases/export:
   *   get:
   *     summary: Export leases to Excel
   *     tags:
   *       - Lease service
   *     description: Export lease search results to Excel file. Uses same filters as /leases/search but without pagination.
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
   *         description: Object types (e.g., residence, parking)
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
   *     produces:
   *       - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   *     responses:
   *       200:
   *         description: Excel file download
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/export', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await leasingAdapter.exportLeasesToExcel(ctx.query)

      if (!result.ok) {
        logger.error({ err: result.err, metadata }, 'Lease export failed')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      ctx.set('Content-Type', result.data.contentType)
      ctx.set('Content-Disposition', result.data.contentDisposition)
      ctx.status = 200
      ctx.body = result.data.data
    } catch (error) {
      logger.error({ error, metadata }, 'Error exporting leases to Excel')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
