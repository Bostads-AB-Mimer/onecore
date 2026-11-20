import KoaRouter from '@koa/router'
import axios from 'axios'
import {
  generateRouteMetadata,
  logger,
  makeSuccessResponseBody,
  createExcelExport,
  joinField,
  formatDateForExcel,
  setExcelDownloadHeaders,
  buildPaginationLinks,
  PaginatedResponse,
} from '@onecore/utilities'
import {
  leasing,
  schemas,
  LeaseStatus,
  LeaseStatusLabel,
  CustomerScoreCardInfoSchema,
} from '@onecore/types'
import z from 'zod'

import {
  GetLeaseOptionsSchema,
  GetLeasesByContactCodeOptionsSchema,
  GetLeasesOptionsSchema,
  LeaseBatchRequestBody,
  mapLease,
  Lease as LeaseSchema,
} from './schemas/lease'
import * as leasingAdapter from '../../adapters/leasing-adapter'
import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import * as propertyManagementAdapter from '../../adapters/property-management-adapter'
import { getHomeInsuranceOfferMonthlyAmount } from './helpers/lease'
import { mapLeasesWithTenants } from './helpers/lease-tenants'
import { resolveBuildingManagerToKvvAreaCodes } from '../../adapters/property-base-adapter/lease-query'
import {
  resolvePersonnummerInQuery,
  enrichLeaseContacts,
} from '../../adapters/contacts-adapter/lease-query'
import { parseRequestBody } from '../../middlewares/parse-request-body'
import { registerSchema } from '../../utils/openapi'
import { errorLogFields } from '../../utils/error-log'
import { HOME_INSURANCE_LF_COLUMNS } from '../../processes/reports/converters/home-insurance-columns'
import {
  HOME_INSURANCE_LIST_ERROR_STATUS,
  HOME_INSURANCE_LIST_RETRY_AFTER_SECONDS,
  homeInsuranceListLinkParams,
  sendHomeInsuranceFailure,
  toHomeInsuranceLfColumnValues,
  toLeasingHomeInsuranceQuery,
  withHomeInsuranceContacts,
} from './helpers/home-insurance'
import {
  HomeInsuranceErrorResponseSchema,
  HomeInsuranceListErrorResponseSchema,
  HomeInsuranceListItemWithContact,
  HomeInsuranceListItemWithContactSchema,
  HomeInsuranceListQuerySchema,
  HomeInsuranceListRouteErrorCode,
  InvalidRequestBodyResponseSchema,
} from './schemas/home-insurance'
import { runWithConcurrency } from '../../utils/concurrency'

registerSchema('CustomerScoreCardInfoSchema', CustomerScoreCardInfoSchema)
registerSchema('HomeInsuranceRow', leasing.HomeInsuranceRowSchema)
registerSchema(
  'UpdateHomeInsuranceRowResponse',
  leasing.UpdateHomeInsuranceRowResponseSchema
)
registerSchema('HomeInsuranceErrorResponse', HomeInsuranceErrorResponseSchema)
registerSchema('InvalidRequestBodyResponse', InvalidRequestBodyResponseSchema)
registerSchema('HomeInsuranceListItem', HomeInsuranceListItemWithContactSchema)
registerSchema(
  'HomeInsuranceListErrorResponse',
  HomeInsuranceListErrorResponseSchema
)

// Same cap as the lease search in leasing. Each lease on a page gets a contact
// and a rental object lookup, so a full page makes about 1000 calls.
const CSC_MAX_PAGE_SIZE = 500
// Leases looked up at once, so a full page doesn't send all its lookups to
// leasing and property-management in one burst.
const CSC_LOOKUP_CONCURRENCY = 20

export const routes = (router: KoaRouter) => {
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
   * /leases/for-csc:
   *   get:
   *     summary: Get all tenants with info required for Customer Score Card (CSC), including their leases and related entities
   *     tags:
   *       - Lease service
   *     description: Returns a list of residential leases, including contact and rental object info. Filters out protected identities, deceased tenants, and certain property types/estates. The filtering runs after paging, so a page can hold fewer rows than `limit` while more pages remain; page until `_meta.page * _meta.limit >= _meta.totalRecords`.
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number. Values below 1 count as 1.
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 500
   *           maximum: 500
   *         description: Leases per page, before filtering. Values above 500 count as 500, values below 1 as 1.
   *     responses:
   *       '200':
   *         description: Successfully retrieved residential leases for the CSC report
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/CustomerScoreCardInfoSchema'
   *                 _meta:
   *                   type: object
   *                   properties:
   *                     totalRecords:
   *                       type: integer
   *                       description: Current residential leases, before filtering
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                       description: The page size used
   *                     count:
   *                       type: integer
   *                       description: Rows on this page, after filtering
   *       '400':
   *         description: Invalid query parameters, e.g. a page or limit that is not a number
   *       '500':
   *         description: Internal server error
   *       '503':
   *         description: The lease service is warming up; try again shortly
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/for-csc', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      // Filter leases on object type 'Bostad' and current leases but allow additional filtering by query params, ie for paging
      const leaseSearchParams = {
        limit: String(CSC_MAX_PAGE_SIZE),
        ...ctx.query,
        objectType: 'bostad',
        status: LeaseStatus[LeaseStatus.Current],
      }

      if (Number(leaseSearchParams.limit) > CSC_MAX_PAGE_SIZE)
        leaseSearchParams.limit = String(CSC_MAX_PAGE_SIZE)

      const leaseSearchResult =
        await leasingAdapter.searchLeases(leaseSearchParams)

      if (
        !leaseSearchResult.content ||
        leaseSearchResult.content.length === 0
      ) {
        ctx.status = 200
        ctx.body = {
          content: [],
          _meta: { ...leaseSearchResult._meta, count: 0 },
          ...metadata,
        }
        return
      }

      //Get contact and rental object info for each lease, and filter out protected identities, deceased tenants, and certain property types/estates
      const parsedContent = await runWithConcurrency(
        leaseSearchResult.content,
        async (lease) => {
          const rentalObjectCode =
            lease.leaseId.split('/')[0] != ''
              ? lease.leaseId.split('/')[0]
              : lease.leaseId.substring(0, lease.leaseId.lastIndexOf('-'))

          if (!lease.contacts || lease.contacts.length === 0) {
            logger.error(
              'No tenant on contract Id ' +
                lease.leaseId +
                ', skipping lease for CSC report'
            )
            return null
          }

          const primaryContactCode = lease.contacts[0].contactCode //TODO: Vilken contact ska väljas när det finns flera?

          const [contactResult, rentalPropertyResult] = await Promise.all([
            leasingAdapter.getContactByContactCode(primaryContactCode),
            propertyManagementAdapter.getRentalPropertyInfoFromXpand(
              rentalObjectCode
            ),
          ])

          if (!contactResult.ok) {
            logger.error(
              {
                status: contactResult.statusCode,
                error: contactResult.err,
                contactCode: primaryContactCode,
              },
              'Failed to fetch contact data'
            )
            return null
          }
          if (!contactResult.data) {
            logger.warn(
              {
                contactCode: primaryContactCode,
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

          //Filter out leases for contacts with protected identity.
          if (tenant.protectedIdentity) return null

          //Filter out leases for deceased contacts.
          if (tenant.deceased) return null

          //Filter out leases for emigrated contacts.
          if (tenant.emigrated) return null

          //Filter out leases for contacts that should not be advertised.
          if (tenant.noAdvertising) return null

          //Filter out leases for customers that are companies (contact code does not start with P).
          if (!tenant.contactCode.startsWith('P')) return null

          //Filter out rental objects that are created for testing purposes in XPand (rental object codes starting with 000-000)
          if (rentalObjectData.id.startsWith('000-000')) return null

          const mappedLease: z.input<typeof CustomerScoreCardInfoSchema> = {
            //lease info
            division_1038: lease.leaseId,
            division_1037: lease.signedAt?.toString(),
            contract_start_date: lease.startDate?.toString() ?? '',
            contract_end_date: lease.endDate?.toString(),
            contract_type: lease.leaseType,
            object_street_1: rentalObjectData.address?.street ?? '',
            object_zip: rentalObjectData.address?.postalCode ?? '',
            object_city: rentalObjectData.address?.city ?? '',
            //contact info
            division_1501: tenant.contactCode,
            respondent_name_first: tenant.firstName,
            respondent_name_last: tenant.lastName,
            respondent_email: tenant.emailAddress ?? '',
            respondent_phone:
              tenant.phoneNumbers?.find((number) => number.isMainNumber)
                ?.phoneNumber ?? '',
            postal_street_1: tenant.address?.street ?? '',
            postal_street_2: tenant.address?.street2 ?? undefined,
            postal_zip: tenant.address?.postalCode ?? '',
            postal_city: tenant.address?.city ?? '',
            //rental object info
            object_ref_nr: rentalObjectData.id,
            division_1011: rentalObjectData.districtCode ?? '',
            object_real_estate: rentalObjectData.property.estate,
            object_real_estate_year_construction:
              rentalObjectData.building.constructionYear ?? undefined,
            object_real_estate_year_reconstruction:
              rentalObjectData.building.renovationYear ?? undefined,
            real_estate_type:
              rentalObjectData.building.buildingTypeCaption ?? '',
            division_1048: rentalObjectData.district ?? '',
            division_1242: rentalObjectData.marketArea ?? '',
            division_1140: rentalObjectData.property.rentalTypeCode,
            object_type: rentalObjectData.type,
          }

          const parseResult = CustomerScoreCardInfoSchema.safeParse(mappedLease)
          if (parseResult.success) {
            return parseResult.data
          } else {
            logger.warn(
              { issues: parseResult.error.issues, lease },
              'Lease validation failed'
            )
            return null
          }
        },
        CSC_LOOKUP_CONCURRENCY
      )

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
      if (axios.isAxiosError(error) && error.response?.status === 503) {
        ctx.status = 503
        ctx.body = { error: 'Lease service is warming up', ...metadata }
        return
      }
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        ctx.status = 400
        ctx.body = {
          error: 'Invalid query parameters',
          reason: error.response.data?.details,
          ...metadata,
        }
        return
      }
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
   * /leases/search:
   *   get:
   *     summary: Search and filter leases
   *     tags:
   *       - Lease service
   *     description: Search leases with comprehensive filtering options.
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Free-text search (contract ID, PNR, contact code)
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: Search by tenant name
   *       - in: query
   *         name: address
   *         schema:
   *           type: string
   *         description: Search by rental object address
   *       - in: query
   *         name: objectType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Object types (bostad, parkering, lokal, ovrigt)
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [current, active, upcoming, abouttoend, ended, pendingsignature, preliminaryterminated, notsent]
   *         description: Contract status filter
   *       - in: query
   *         name: leaseType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Lease type filter
   *       - in: query
   *         name: parkingSpaceType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Parking space type filter
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
   *         description: Keycloak user IDs of property managers (kvartersvärdar) — core resolves these to KVV-area codes before filtering
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
   *           maximum: 500
   *         description: Items per page
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseStartDate, lastDebitDate, leaseId, address, objectType, rentalObjectCode, tenantName]
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

    const parsed = leasing.v1.LeaseSearchQueryParamsSchema.safeParse(ctx.query)

    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        error: 'Invalid query parameters',
        details: parsed.error.issues,
        ...metadata,
      }
      return
    }

    const resolved = await resolveBuildingManagerToKvvAreaCodes(ctx.query)
    if (!resolved.ok) {
      ctx.status = 500
      ctx.body = { error: resolved.reason, ...metadata }
      return
    }

    try {
      const searchQuery = await resolvePersonnummerInQuery(resolved.query)
      const result = await leasingAdapter.searchLeases(searchQuery)
      const enrichedContent = await enrichLeaseContacts(
        result.content,
        'leases/search'
      )

      ctx.status = 200
      ctx.body = { ...result, content: enrichedContent }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 503) {
        ctx.status = 503
        ctx.body = { error: 'Lease service is warming up', ...metadata }
        return
      }
      logger.error({ error, metadata }, 'Error searching leases (Tenfast)')
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
        const parsedLeases = LeaseSchema.array().safeParse(leases.map(mapLease))
        if (!parsedLeases.success) {
          logger.error(
            { issues: parsedLeases.error.issues, metadata },
            'Leases do not match documented schema'
          )
          ctx.status = 500
          ctx.body = { error: 'Invalid lease data', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(parsedLeases.data, metadata)
        return
      }

      const patchedLeases = await mapLeasesWithTenants(leases)

      if (!patchedLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchedLeases.err,
          ...metadata,
        }

        return
      }

      const parsedPatchedLeases = LeaseSchema.array().safeParse(
        patchedLeases.data
      )
      if (!parsedPatchedLeases.success) {
        logger.error(
          { issues: parsedPatchedLeases.error.issues, metadata },
          'Leases do not match documented schema'
        )
        ctx.status = 500
        ctx.body = { error: 'Invalid lease data', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(parsedPatchedLeases.data, metadata)
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

      // Leasing answers 200 with a null contact for an unknown pnr.
      if (!contact) {
        ctx.status = 200
        ctx.body = makeSuccessResponseBody([], metadata)
        return
      }

      // TODO(BREAKING): includeContacts no longer defaults to true
      const leases = await leasingAdapter.getLeasesByContactCode(
        contact.contactCode,
        queryParams.data
      )

      if (!queryParams.data.includeContacts) {
        const parsedLeases = LeaseSchema.array().safeParse(leases.map(mapLease))
        if (!parsedLeases.success) {
          logger.error(
            { issues: parsedLeases.error.issues, metadata },
            'Leases do not match documented schema'
          )
          ctx.status = 500
          ctx.body = { error: 'Invalid lease data', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(parsedLeases.data, metadata)
        return
      }

      const patchedLeases = await mapLeasesWithTenants(leases)
      if (!patchedLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchedLeases.err,
          ...metadata,
        }
        return
      }

      const parsedPatchedLeases = LeaseSchema.array().safeParse(
        patchedLeases.data
      )
      if (!parsedPatchedLeases.success) {
        logger.error(
          { issues: parsedPatchedLeases.error.issues, metadata },
          'Leases do not match documented schema'
        )
        ctx.status = 500
        ctx.body = { error: 'Invalid lease data', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(parsedPatchedLeases.data, metadata)
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
   *       - in: query
   *         name: includeSubletLeases
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Also return leases where the contact is the current sublet tenant (andrahandshyresgäst).
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
      const queryParams = GetLeasesByContactCodeOptionsSchema.safeParse(
        ctx.query
      )

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
        const parsedLeases = LeaseSchema.array().safeParse(leases.map(mapLease))
        if (!parsedLeases.success) {
          logger.error(
            { issues: parsedLeases.error.issues, metadata },
            'Leases do not match documented schema'
          )
          ctx.status = 500
          ctx.body = { error: 'Invalid lease data', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(parsedLeases.data, metadata)
        return
      }

      const patchedLeases = await mapLeasesWithTenants(leases)
      if (!patchedLeases.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchedLeases.err,
          ...metadata,
        }
        return
      }

      const parsedPatchedLeases = LeaseSchema.array().safeParse(
        patchedLeases.data
      )
      if (!parsedPatchedLeases.success) {
        logger.error(
          { issues: parsedPatchedLeases.error.issues, metadata },
          'Leases do not match documented schema'
        )
        ctx.status = 500
        ctx.body = { error: 'Invalid lease data', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(parsedPatchedLeases.data, metadata)
    } catch (err) {
      logger.error({ err, metadata }, 'Error fetching leases from leasing')
      ctx.status = 500
      ctx.body = {
        error: 'Internal server error',
        ...metadata,
      }
    }
  })

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
   *         name: name
   *         schema:
   *           type: string
   *         description: Search by tenant name
   *       - in: query
   *         name: address
   *         schema:
   *           type: string
   *         description: Search by rental object address
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
   *         description: Contract status filter (0=Current, 1=Upcoming, 2=AboutToEnd, 3=Ended)
   *       - in: query
   *         name: leaseType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Lease type filter
   *       - in: query
   *         name: parkingSpaceType
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         description: Parking space type filter
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
   *         description: Keycloak user IDs of property managers (kvartersvärdar) — core resolves these to KVV-area codes before filtering
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseStartDate, lastDebitDate, leaseId, address, objectType, rentalObjectCode, tenantName]
   *         description: Sort field
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort direction
   *     produces:
   *       - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   *     responses:
   *       200:
   *         description: Excel file download
   *         content:
   *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
   *             schema:
   *               type: string
   *               format: binary
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/export', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const resolved = await resolveBuildingManagerToKvvAreaCodes(ctx.query)
    if (!resolved.ok) {
      ctx.status = 500
      ctx.body = { error: resolved.reason, ...metadata }
      return
    }

    try {
      const exportQuery = await resolvePersonnummerInQuery(resolved.query)
      const result = await leasingAdapter.getLeasesForExport(exportQuery)

      if (!result.ok) {
        logger.error({ err: result.err, metadata }, 'Lease export failed')
        ctx.status = 500
        ctx.body = { error: 'Internal server error', ...metadata }
        return
      }

      const rawLeases = result.data
      const enrichedLeases = await enrichLeaseContacts(
        rawLeases,
        'leases/export'
      )

      const buffer = await createExcelExport<leasing.v1.LeaseSearchResult>({
        sheetName: 'Hyreskontrakt',
        columns: [
          { header: 'Kontraktsnummer', key: 'leaseId', width: 18 },
          { header: 'Objektnummer', key: 'rentalObjectCode', width: 20 },
          { header: 'Hyresgäst', key: 'tenantName', width: 30 },
          { header: 'Kundnummer', key: 'contactCode', width: 18 },
          { header: 'E-post', key: 'email', width: 30 },
          { header: 'Telefon', key: 'phone', width: 15 },
          { header: 'Objekttyp', key: 'objectType', width: 12 },
          { header: 'Kontraktstyp', key: 'leaseType', width: 20 },
          { header: 'Adress', key: 'address', width: 35 },
          { header: 'Fastighet', key: 'property', width: 20 },
          { header: 'Distrikt', key: 'district', width: 15 },
          { header: 'Startdatum', key: 'startDate', width: 12 },
          { header: 'Slutdatum', key: 'endDate', width: 12 },
          { header: 'Status', key: 'status', width: 15 },
        ],
        data: enrichedLeases,
        rowMapper: (lease: leasing.v1.LeaseSearchResult) => ({
          leaseId: lease.leaseId,
          rentalObjectCode: lease.rentalObjectCode || '',
          tenantName: joinField(lease.contacts, (c) =>
            c.contactType === 'subletTenant' ? `${c.name} (andrahand)` : c.name
          ),
          contactCode: joinField(lease.contacts, (c) =>
            c.contactType === 'subletTenant'
              ? `${c.contactCode} (andrahand)`
              : c.contactCode
          ),
          email: joinField(lease.contacts, (c) => c.email),
          phone: joinField(lease.contacts, (c) => c.phone),
          objectType: lease.parkingSpaceType || lease.objectTypeCode,
          leaseType: lease.leaseType,
          address: lease.address || '',
          property: lease.property || '',
          district: lease.districtName || '',
          startDate: formatDateForExcel(lease.startDate),
          endDate: formatDateForExcel(lease.lastDebitDate),
          status: LeaseStatusLabel[lease.status] ?? String(lease.status),
        }),
      })

      setExcelDownloadHeaders(ctx, 'hyreskontrakt')
      ctx.status = 200
      ctx.body = buffer
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 503) {
        ctx.status = 503
        ctx.body = { error: 'Lease service is warming up', ...metadata }
        return
      }
      logger.error({ error, metadata }, 'Error exporting leases to Excel')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  /**
   * Answers a failed home insurance list or export with its status and code.
   * cache-warming keeps leasing's Retry-After.
   */
  const sendHomeInsuranceListFailure = (
    ctx: KoaRouter.RouterContext,
    failure: { err: HomeInsuranceListRouteErrorCode; retryAfter?: string },
    metadata: object
  ) => {
    if (failure.err === 'cache-warming') {
      ctx.set(
        'Retry-After',
        failure.retryAfter ?? HOME_INSURANCE_LIST_RETRY_AFTER_SECONDS
      )
    }
    ctx.status = HOME_INSURANCE_LIST_ERROR_STATUS[failure.err]
    ctx.body = { error: failure.err, ...metadata }
  }

  /**
   * @swagger
   * /leases/home-insurances:
   *   get:
   *     summary: List home insurance rows (staff)
   *     description: >
   *       The home insurance rows of all leases, with the tenant's name,
   *       personal identity number, phone and email from the contacts
   *       service. Those four fields are null when the contacts service
   *       fails, when the tenant has a protected identity, or when the
   *       contacts service has no record of the tenant. A personnummer in q
   *       is looked up in the contacts service; one with no contact gives an
   *       empty list. Requires the home-insurance:read role.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: A personnummer, or text matched against the lease ID, rental object code, contact code and address of the rental object, ignoring case.
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [G, K, '*']
   *         style: form
   *         explode: false
   *         description: Status as in the Länsförsäkringar file. G in force, K on a lease to come, * the row has an end date.
   *       - in: query
   *         name: rows
   *         schema:
   *           type: string
   *           enum: [lf, all]
   *           default: lf
   *         description: lf gives the rows of the Länsförsäkringar file, one per lease. all gives every home insurance row, for quality checks.
   *       - in: query
   *         name: sameDate
   *         schema:
   *           type: boolean
   *         description: Only rows whose first and last day are the same day.
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseId, leaseStatus, leaseFromDate, leaseToDate, rentalObjectCode, address, rowFromDate, rowToDate, monthlyAmount, contactCode]
   *           default: leaseId
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: asc
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 500
   *           default: 50
   *     responses:
   *       '200':
   *         description: One page of home insurance rows. A search without matches gives an empty list.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content, _meta, _links]
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/HomeInsuranceListItem'
   *                 _meta:
   *                   $ref: '#/components/schemas/PaginationMeta'
   *                 _links:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/PaginationLinks'
   *       '400':
   *         description: Invalid query parameters (error invalid-query).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceListErrorResponse'
   *       '403':
   *         description: The caller lacks the home-insurance:read role.
   *       '500':
   *         description: Unexpected answer from the leasing service (error unknown).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceListErrorResponse'
   *       '503':
   *         description: >
   *           The list is loading from the leasing system for the first time (error
   *           cache-warming, retry after the Retry-After header), or the leasing system or
   *           the contacts service could not be read (error upstream-failed).
   *         headers:
   *           Retry-After:
   *             schema:
   *               type: integer
   *             description: Seconds to wait, sent with cache-warming.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceListErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/home-insurances', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const parsed = HomeInsuranceListQuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        error: 'invalid-query',
        details: parsed.error.issues,
        ...metadata,
      }
      return
    }
    const query = parsed.data

    const leasingQuery = await toLeasingHomeInsuranceQuery(query)
    if (!leasingQuery.ok) {
      sendHomeInsuranceListFailure(ctx, leasingQuery, metadata)
      return
    }

    const result = await leasingAdapter.listHomeInsurances(leasingQuery.query)
    if (!result.ok) {
      sendHomeInsuranceListFailure(ctx, result, metadata)
      return
    }

    const { content, _meta } = result.data
    const body: PaginatedResponse<HomeInsuranceListItemWithContact> = {
      content: await withHomeInsuranceContacts(content),
      _meta,
      _links: buildPaginationLinks(
        ctx,
        _meta.page,
        _meta.limit,
        Math.ceil(_meta.totalRecords / _meta.limit),
        homeInsuranceListLinkParams(query)
      ),
    }

    ctx.status = 200
    ctx.body = body
  })

  /**
   * @swagger
   * /leases/home-insurances/export:
   *   get:
   *     summary: Export home insurance rows to Excel (staff)
   *     description: >
   *       Every row of GET /leases/home-insurances that matches the filters,
   *       in the 18 columns of the Länsförsäkringar file. The person fields
   *       follow the same rules as the list: from the contacts service only,
   *       and empty for a protected identity or when the contacts service
   *       fails. Takes the same query parameters as the list, without page
   *       and limit. Requires the home-insurance:read role.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             enum: [G, K, '*']
   *         style: form
   *         explode: false
   *       - in: query
   *         name: rows
   *         schema:
   *           type: string
   *           enum: [lf, all]
   *           default: lf
   *       - in: query
   *         name: sameDate
   *         schema:
   *           type: boolean
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [leaseId, leaseStatus, leaseFromDate, leaseToDate, rentalObjectCode, address, rowFromDate, rowToDate, monthlyAmount, contactCode]
   *           default: leaseId
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *           default: asc
   *     responses:
   *       '200':
   *         description: Excel file download.
   *         content:
   *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
   *             schema:
   *               type: string
   *               format: binary
   *       '400':
   *         description: Invalid query parameters (error invalid-query).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceListErrorResponse'
   *       '403':
   *         description: The caller lacks the home-insurance:read role.
   *       '500':
   *         description: Unexpected answer from the leasing service (error unknown), or the file could not be built.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceListErrorResponse'
   *       '503':
   *         description: The list is loading from the leasing system for the first time (error cache-warming, with Retry-After), or the leasing system or the contacts service could not be read (error upstream-failed).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceListErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/home-insurances/export', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const parsed = HomeInsuranceListQuerySchema.safeParse(ctx.query)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        error: 'invalid-query',
        details: parsed.error.issues,
        ...metadata,
      }
      return
    }

    const leasingQuery = await toLeasingHomeInsuranceQuery(parsed.data)
    if (!leasingQuery.ok) {
      sendHomeInsuranceListFailure(ctx, leasingQuery, metadata)
      return
    }

    const result = await leasingAdapter.listAllHomeInsurances(
      leasingQuery.query
    )
    if (!result.ok) {
      sendHomeInsuranceListFailure(ctx, result, metadata)
      return
    }

    try {
      const rows = await withHomeInsuranceContacts(result.data)
      const buffer = await createExcelExport<HomeInsuranceListItemWithContact>({
        sheetName: 'Hemförsäkring',
        columns: HOME_INSURANCE_LF_COLUMNS.map((column) => ({
          header: column.header,
          key: column.key,
          width: 20,
        })),
        data: rows,
        rowMapper: toHomeInsuranceLfColumnValues,
      })

      setExcelDownloadHeaders(ctx, 'hemforsakringar')
      ctx.body = buffer
    } catch (err: unknown) {
      // Named fields only: metadata holds the request URL, whose q can be
      // a personal identity number.
      logger.error(
        { ...errorLogFields(err), rows: result.data.length },
        'Error building the home insurance Excel export'
      )
      ctx.status = 500
      ctx.body = { error: 'unknown', ...metadata }
    }
  })

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance/rows/{rowId}:
   *   patch:
   *     summary: End or remove a home insurance row (staff)
   *     description: >
   *       Ends the home insurance row on endDate. action cancel removes the
   *       row when endDate is on or before its first day, and otherwise ends
   *       it on endDate. action set-end ends it on endDate, which may not be
   *       before its first day. Ending a row gives it a new rowId. rowId is
   *       the row as last read from GET /leases/{leaseId}/home-insurance or
   *       the list; if someone else changed the rows, the answer is 409 and
   *       the row must be read again. Leasing's errors are passed on as they
   *       are. Requires the home-insurance:write role.
   *     tags:
   *       - Lease service
   *     parameters:
   *       - in: path
   *         name: leaseId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the lease.
   *       - in: path
   *         name: rowId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rowId of the home insurance row.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - endDate
   *               - action
   *             properties:
   *               endDate:
   *                 type: string
   *                 format: date
   *                 description: The last day the home insurance is in force, as yyyy-mm-dd.
   *               action:
   *                 type: string
   *                 enum: [cancel, set-end]
   *     responses:
   *       '200':
   *         description: The row was removed (action deleted, row null) or ended (action ended, row is the new row).
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/UpdateHomeInsuranceRowResponse'
   *       '400':
   *         description: >
   *           The request body is invalid (an InvalidRequestBodyResponse,
   *           with no error code), endDate is before the row's first day with
   *           action set-end (error end-date-before-start), or the row already
   *           ends on endDate (error end-date-unchanged).
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - $ref: '#/components/schemas/InvalidRequestBodyResponse'
   *                 - $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       '403':
   *         description: The caller lacks the home-insurance:write role.
   *       '404':
   *         description: The lease was not found (error lease-not-found), or it has no home insurance row (error home-insurance-row-not-found).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       '409':
   *         description: The lease has no row with this rowId, or the rows were changed by someone else during the write (error home-insurance-row-changed). Read the row again.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       '500':
   *         description: Unexpected answer from the leasing service, or no answer (error unknown). The row may have been written.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       '503':
   *         description: The leasing system could not be read or written, or the write could not be checked (error upstream-failed).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *     security:
   *       - bearerAuth: []
   */
  router.patch(
    '/leases/:leaseId/home-insurance/rows/:rowId',
    parseRequestBody(leasing.UpdateHomeInsuranceRowRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { leaseId, rowId } = ctx.params
      const { endDate, action } = ctx.request.body

      const result = await leasingAdapter.updateLeaseHomeInsuranceRow(
        leaseId,
        rowId,
        { endDate, action }
      )

      // Audit trail of who changed which row. No tenant data.
      logger.info(
        {
          leaseId,
          rowId,
          action,
          endDate,
          outcome: result.ok ? result.data.action : result.err,
          newRowId: result.ok ? (result.data.row?.rowId ?? null) : null,
          user: ctx.state.user?.preferred_username ?? null,
        },
        'Home insurance row update'
      )

      if (!result.ok) {
        sendHomeInsuranceFailure(ctx, result, metadata)
        return
      }

      ctx.status = 200
      ctx.body =
        makeSuccessResponseBody<leasing.UpdateHomeInsuranceRowResponse>(
          result.data,
          metadata
        )
    }
  )

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
        const parsedLease = LeaseSchema.safeParse(mapLease(lease))
        if (!parsedLease.success) {
          logger.error(
            { issues: parsedLease.error.issues, metadata },
            'Lease does not match documented schema'
          )
          ctx.status = 500
          ctx.body = { error: 'Invalid lease data', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(parsedLease.data, metadata)
        return
      }

      if (!lease.tenantContactIds) {
        logger.error(
          { metadata, leaseId: lease.leaseId },
          'Lease has no tenant contact IDs'
        )
        const parsedLease = LeaseSchema.safeParse(mapLease(lease))
        if (!parsedLease.success) {
          logger.error(
            { issues: parsedLease.error.issues, metadata },
            'Lease does not match documented schema'
          )
          ctx.status = 500
          ctx.body = { error: 'Invalid lease data', ...metadata }
          return
        }

        ctx.status = 200
        ctx.body = makeSuccessResponseBody(parsedLease.data, metadata)
        return
      }

      const patchedLease = await mapLeasesWithTenants([lease])

      if (!patchedLease.ok) {
        ctx.status = 500
        ctx.body = {
          error: patchedLease.err,
          ...metadata,
        }
        return
      }

      const [leaseWithContacts] = patchedLease.data
      const parsedLeaseWithContacts = LeaseSchema.safeParse(leaseWithContacts)
      if (!parsedLeaseWithContacts.success) {
        logger.error(
          { issues: parsedLeaseWithContacts.error.issues, metadata },
          'Lease does not match documented schema'
        )
        ctx.status = 500
        ctx.body = { error: 'Invalid lease data', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(parsedLeaseWithContacts.data, metadata)
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
   * /leases/batch:
   *   post:
   *     summary: Get multiple leases by id
   *     tags:
   *       - Lease service
   *     description: Retrieves leases for a batch of lease ids in a single call.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - leaseIds
   *             properties:
   *               leaseIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 minItems: 1
   *     responses:
   *       '200':
   *         description: Successful response with the requested leases
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
   *         description: Invalid request body
   *       '500':
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '/leases/batch',
    parseRequestBody(LeaseBatchRequestBody),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { leaseIds } = ctx.request.body as z.infer<
        typeof LeaseBatchRequestBody
      >

      try {
        const leases = await leasingAdapter.getLeasesBatch(leaseIds)

        ctx.status = 200
        ctx.body = {
          content: leases.map(mapLease),
          ...metadata,
        }
      } catch (err) {
        logger.error(
          { err, metadata },
          'Error fetching lease batch from leasing'
        )
        ctx.status = 500
      }
    }
  )

  /**
   * @swagger
   * /leases/{leaseId}/home-insurance:
   *   get:
   *     summary: Get home insurance for a lease
   *     description: >
   *       The lease's current home insurance row: the row in force today,
   *       else the next one to start, else the one that ended last. rowId
   *       identifies the row for PATCH
   *       /leases/{leaseId}/home-insurance/rows/{rowId}.
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [content]
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/HomeInsuranceRow'
   *       404:
   *         description: The lease was not found (error lease-not-found), or it has no home insurance row (error home-insurance-row-not-found).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       500:
   *         description: Unexpected answer from the leasing service (error unknown).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       503:
   *         description: The leasing system could not be read (error upstream-failed).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   */
  router.get('/leases/:leaseId/home-insurance', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const result = await leasingAdapter.getLeaseHomeInsurance(
      ctx.params.leaseId
    )

    if (!result.ok) {
      sendHomeInsuranceFailure(ctx, result, metadata)
      return
    }

    ctx.status = 200
    ctx.body = makeSuccessResponseBody<leasing.HomeInsuranceRow>(
      result.data,
      metadata
    )
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
   *         description: >
   *           Home insurance cancelled: the row in force on endDate now ends
   *           on it, and rows that would start after it are removed. Without
   *           a row in force on endDate, the first row to start after it ends
   *           on its own first day. One row is always kept.
   *       400:
   *         description: The request body is invalid.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/InvalidRequestBodyResponse'
   *       404:
   *         description: The lease was not found (error lease-not-found), or it has no home insurance row (error home-insurance-row-not-found).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       409:
   *         description: A row to end or remove was changed by someone else at the same time (error home-insurance-row-changed). Nothing was written; try again.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       500:
   *         description: Unexpected answer from the leasing service, or no answer (error unknown).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   *       503:
   *         description: The leasing system could not be read or written (error upstream-failed).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HomeInsuranceErrorResponse'
   */
  router.post(
    '/leases/:leaseId/home-insurance/cancel',
    parseRequestBody(leasing.v1.CancelLeaseHomeInsuranceRequestSchema),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      // No checks before the write: leasing finds the lease and its row and
      // answers with a typed error when either is missing.
      const cancelLeaseHomeInsuranceResult =
        await leasingAdapter.cancelLeaseHomeInsurance(ctx.params.leaseId, {
          endDate: ctx.request.body.endDate,
        })

      if (!cancelLeaseHomeInsuranceResult.ok) {
        sendHomeInsuranceFailure(ctx, cancelLeaseHomeInsuranceResult, metadata)
        return
      }

      ctx.status = 200
      ctx.body = makeSuccessResponseBody(null, metadata)
    }
  )
}
