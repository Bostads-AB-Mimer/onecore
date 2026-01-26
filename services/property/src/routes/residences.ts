import KoaRouter from '@koa/router'
import {
  logger,
  generateRouteMetadata,
  buildPaginatedResponse,
} from '@onecore/utilities'
import { z } from 'zod'

import {
  getResidenceById,
  getResidenceSizeByRentalId,
  getResidencesByBuildingCode,
  getResidencesByBuildingCodeAndStaircaseCode,
  searchResidences,
  getResidenceByRentalId,
  getResidenceSummariesByBuildingCodeAndStaircaseCode,
  getRentalBlocksByRentalId,
  getAllRentalBlocks,
  searchRentalBlocks,
  getAllRentalBlocksForExport,
  getAllBlockReasons,
} from '../adapters/residence-adapter'
import {
  residencesQueryParamsSchema,
  ResidenceSchema,
  ResidenceDetailedSchema,
  ResidenceSearchResult,
  GetResidenceByRentalIdResponse,
  ResidenceSummarySchema,
  RentalBlock,
  getAllRentalBlocksQueryParamsSchema,
  searchRentalBlocksQueryParamsSchema,
  exportRentalBlocksQueryParamsSchema,
} from '../types/residence'
import { parseRequest } from '../middleware/parse-request'

type ResidenceDetails = z.infer<typeof ResidenceDetailedSchema>

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Residences
 *     description: Operations related to residences
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /residences:
   *   get:
   *     summary: Get residences by building code, optionally filtered by staircase code.
   *     description: Returns all residences belonging to a specific building, optionally filtered by staircase code.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building.
   *       - in: query
   *         name: staircaseCode
   *         required: false
   *         schema:
   *           type: string
   *         description: The code of the staircase (optional).
   *     responses:
   *       200:
   *         description: Successfully retrieved the residences.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Residence'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */

  type Residence = z.infer<typeof ResidenceSchema>
  router.get(
    ['(.*)/residences'],
    parseRequest({ query: residencesQueryParamsSchema }),
    async (ctx) => {
      const { buildingCode, staircaseCode } = ctx.request.parsedQuery

      const metadata = generateRouteMetadata(ctx)

      try {
        let dbResidences

        if (staircaseCode) {
          dbResidences = await getResidencesByBuildingCodeAndStaircaseCode(
            buildingCode,
            staircaseCode
          )
        } else {
          dbResidences = await getResidencesByBuildingCode(buildingCode)
        }

        const responseContent = dbResidences.map(
          (v): Residence => ({
            code: v.code,
            id: v.id,
            name: v.name || '',
            deleted: Boolean(v.deleted),
            validityPeriod: { fromDate: v.fromDate, toDate: v.toDate },
          })
        )

        ctx.status = 200
        ctx.body = {
          content: ResidenceSchema.array().parse(responseContent),
          ...metadata,
        }
      } catch (err) {
        logger.error({ err }, 'residences route error')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /residences/summary/by-building-code/{buildingCode}:
   *   get:
   *     summary: Get residences by building code, optionally filtered by staircase code.
   *     description: Returns all residences belonging to a specific building, optionally filtered by staircase code.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: path
   *         name: buildingCode
   *         required: true
   *         schema:
   *           type: string
   *         description: The building code of the building.
   *       - in: query
   *         name: staircaseCode
   *         required: false
   *         schema:
   *           type: string
   *         description: The code of the staircase (optional).
   *     responses:
   *       200:
   *         description: Successfully retrieved the residences.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ResidenceSummary'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */

  const ResidenceSummaryQueryParamsSchema = z.object({
    staircaseCode: z.string().optional(),
  })

  router.get(
    ['(.*)/residences/summary/by-building-code/:buildingCode'],
    parseRequest({ query: ResidenceSummaryQueryParamsSchema }),
    async (ctx) => {
      const { buildingCode } = ctx.params
      const { staircaseCode } = ctx.request.parsedQuery

      const metadata = generateRouteMetadata(ctx)

      try {
        let dbResidences

        dbResidences =
          await getResidenceSummariesByBuildingCodeAndStaircaseCode(
            buildingCode,
            staircaseCode
          )

        const responseContent = dbResidences.map(
          (v): z.infer<typeof ResidenceSummarySchema> => ({
            id: v.propertyObject.residence?.id || '',
            code: v.propertyObject.residence?.code || '',
            name: v.propertyObject.residence?.name || null,
            buildingCode: v.buildingCode || '',
            buildingName: v.buildingName || '',
            rentalId: v.rentalId || '',
            staircaseName: v.staircaseName || '',
            staircaseCode: v.staircaseCode || '',
            deleted: Boolean(v.propertyObject.residence?.deleted),
            validityPeriod: {
              fromDate: v.propertyObject.residence?.fromDate || null,
              toDate: v.propertyObject.residence?.toDate || null,
            },
            residenceType: {
              code: v.propertyObject.residence?.residenceType?.code || '',
              name: v.propertyObject.residence?.residenceType?.name || '',
              roomCount:
                v.propertyObject.residence?.residenceType?.roomCount || 0,
              kitchen: v.propertyObject.residence?.residenceType?.kitchen || 0,
            },
            quantityValues: v.propertyObject?.quantityValues || [],
            wheelchairAccessible: 0,
            hygieneFacility: null,
            elevator: v.propertyObject.residence?.elevator || null,
            floor: v.propertyObject.residence?.floor || '',
          })
        )

        ctx.status = 200
        ctx.body = {
          content: ResidenceSummarySchema.array().parse(responseContent),
          ...metadata,
        }
      } catch (err) {
        logger.error({ err }, 'residences route error')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /residences/search:
   *   get:
   *     summary: Search residences
   *     description: |
   *       Searches for residences by rental ID or name. The search query is matched against both fields using a case-insensitive contains operation. Returns up to 10 results.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: The search query. Matches against rental ID or residence name.
   *     responses:
   *       200:
   *         description: Successfully retrieved list of residences.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ResidenceSearchResult'
   *       400:
   *         description: Invalid query parameters.
   *       500:
   *         description: Internal server error.
   */
  const ResidenceSearchQueryParamsSchema = z.object({
    q: z.string().min(3),
  })

  router.get(
    '(.*)/residences/search',
    parseRequest({ query: ResidenceSearchQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { q } = ctx.request.parsedQuery

      try {
        // Search for residences by rental id and name
        const residences = await searchResidences(q, ['rentalId', 'name'])

        ctx.status = 200
        ctx.body = {
          content: residences.map(
            (r): ResidenceSearchResult => ({
              id: r.id,
              code: r.code,
              name: r.name || '',
              deleted: Boolean(r.deleted),
              validityPeriod: { fromDate: r.fromDate, toDate: r.toDate },
              rentalId: r.propertyObject.propertyStructures[0].rentalId,
              property: {
                code: r.propertyObject.propertyStructures[0].propertyCode,
                name: r.propertyObject.propertyStructures[0].propertyName,
              },
              building: {
                code: r.propertyObject.propertyStructures[0].buildingCode,
                name: r.propertyObject.propertyStructures[0].buildingName,
              },
            })
          ),
          ...metadata,
        }
      } catch (err) {
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /residences/rental-id/{rentalId}:
   *   get:
   *     summary: Get a residence by rental ID
   *     description: Returns a residence with the specified rental ID
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: path
   *         name: rentalId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental ID of the residence
   *     responses:
   *       200:
   *         description: Successfully retrieved the residence
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/GetResidenceByRentalIdResponse'
   *       404:
   *         description: Residence not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/residences/rental-id/:rentalId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const result = await getResidenceByRentalId(ctx.params.rentalId)
      const areaSize = await getResidenceSizeByRentalId(ctx.params.rentalId)

      const payload: GetResidenceByRentalIdResponse = {
        content: {
          id: result.propertyObject.residence.id,
          code: result.propertyObject.residence.code,
          name: result.propertyObject.residence.name,
          entrance: result.staircaseCode,
          floor: result.propertyObject.residence.floor,
          accessibility: {
            elevator: Boolean(result.propertyObject.residence.elevator),
            wheelchairAccessible: Boolean(
              result.propertyObject.residence.wheelchairAccessible
            ),
          },
          features: {
            hygieneFacility: result.propertyObject.residence.hygieneFacility,
          },
          deleted: Boolean(result.propertyObject.residence.deleted),
          type: {
            code: result.propertyObject.residence.residenceType.code,
            name: result.propertyObject.residence.residenceType.name,
            roomCount: result.propertyObject.residence.residenceType.roomCount,
            kitchen: result.propertyObject.residence.residenceType.kitchen,
          },
          areaSize: areaSize?.value ?? null,
          building: {
            id: result.buildingId,
            code: result.buildingCode,
            name: result.buildingName,
          },
          property: {
            id: result.propertyId,
            code: result.propertyCode,
            name: result.propertyName,
          },
          staircase: result.staircase
            ? {
                id: result.staircase.id,
                code: result.staircase.code,
                name: result.staircase.name,
                features: {
                  floorPlan: result.staircase.floorPlan,
                  accessibleByElevator: Boolean(
                    result.staircase.accessibleByElevator
                  ),
                },
                dates: {
                  from: result.staircase.fromDate,
                  to: result.staircase.toDate,
                },
                deleted: Boolean(result.staircase.deleteMark),
                timestamp: result.staircase.timestamp,
              }
            : null,
          rentalInformation: {
            rentalId: result.rentalId,
            apartmentNumber:
              result.propertyObject.rentalInformation.apartmentNumber,
            type: {
              code: result.propertyObject.rentalInformation
                .rentalInformationType.code,
              name: result.propertyObject.rentalInformation
                .rentalInformationType.name,
            },
          },
        },
        ...metadata,
      }

      ctx.status = 200
      ctx.body = payload
    } catch (err) {
      logger.error(err, 'Error fetching residence rental property info')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /residences/rental-id/{rentalId}/rental-blocks:
   *   get:
   *     summary: Get rental blocks by rental ID
   *     description: Returns all rental blocks for the specified rental ID
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: path
   *         name: rentalId
   *         required: true
   *         schema:
   *           type: string
   *         description: The rental ID
   *       - in: query
   *         name: active
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Filter rental blocks by active status. true = not yet ended (toDate >= today or null), false = already ended (toDate < today). If omitted, include all blocks.
   *     responses:
   *       200:
   *         description: Successfully retrieved the rental blocks
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalBlock'
   *       404:
   *         description: Rental ID not found
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/residences/rental-id/:rentalId/rental-blocks',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const rentalId = ctx.params.rentalId
      const activeParam = ctx.query.active as string | undefined
      const active =
        activeParam === 'true'
          ? true
          : activeParam === 'false'
            ? false
            : undefined

      try {
        const rentalBlocks = await getRentalBlocksByRentalId(rentalId, {
          active,
        })

        if (rentalBlocks === null) {
          ctx.status = 404
          ctx.body = { reason: 'Rental ID not found', ...metadata }
          return
        }

        const mappedRentalBlocks: RentalBlock[] = rentalBlocks.map((rb) => ({
          id: rb.id,
          blockReasonId: rb.blockReasonId,
          blockReason: rb.blockReason?.caption ?? null,
          fromDate: rb.fromDate,
          toDate: rb.toDate,
          amount: rb.amount,
        }))

        ctx.status = 200
        ctx.body = {
          content: mappedRentalBlocks,
          ...metadata,
        }
      } catch (err) {
        logger.error(err, 'Error fetching rental blocks by rental ID')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /residences/rental-blocks/export:
   *   get:
   *     summary: Export all rental blocks to Excel
   *     description: Generates and downloads an Excel file with all rental blocks matching the filters
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Search term (min 2 chars)
   *       - in: query
   *         name: kategori
   *         schema:
   *           type: string
   *           enum: [Bostad, Bilplats, Lokal, Förråd, Övrigt]
   *       - in: query
   *         name: distrikt
   *         schema:
   *           type: string
   *       - in: query
   *         name: blockReason
   *         schema:
   *           type: string
   *       - in: query
   *         name: fastighet
   *         schema:
   *           type: string
   *       - in: query
   *         name: fromDateGte
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: toDateLte
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: active
   *         schema:
   *           type: boolean
   *         description: Filter by active status. true = not yet ended (toDate >= today or null), false = already ended (toDate < today). If omitted, all blocks.
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
   */
  router.get(
    '(.*)/residences/rental-blocks/export',
    parseRequest({ query: exportRentalBlocksQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)

      try {
        const allBlocks = await getAllRentalBlocksForExport(
          ctx.request.parsedQuery
        )

        // Dynamic import of ExcelJS to avoid loading it on every request
        const ExcelJS = await import('exceljs')
        const workbook = new ExcelJS.default.Workbook()
        const worksheet = workbook.addWorksheet('Spärrlista')

        // Add columns
        worksheet.columns = [
          { header: 'Hyresobjekt', key: 'hyresobjekt', width: 15 },
          { header: 'Kategori', key: 'kategori', width: 12 },
          { header: 'Typ', key: 'typ', width: 15 },
          { header: 'Adress', key: 'adress', width: 30 },
          { header: 'Fastighet', key: 'fastighet', width: 15 },
          { header: 'Distrikt', key: 'distrikt', width: 15 },
          { header: 'Orsak', key: 'orsak', width: 35 },
          { header: 'Startdatum', key: 'startdatum', width: 12 },
          { header: 'Slutdatum', key: 'slutdatum', width: 12 },
          { header: 'Hyra (kr/mån)', key: 'hyra', width: 15 },
          {
            header: 'Estimerat Hyresbortfall (kr)',
            key: 'hyresbortfall',
            width: 22,
          },
        ]

        // Style header row
        worksheet.getRow(1).font = { bold: true }

        // Add rows
        for (const block of allBlocks) {
          worksheet.addRow({
            hyresobjekt:
              block.rentalObject?.rentalId || block.rentalObject?.code || '',
            kategori: block.rentalObject?.category || '',
            typ: block.rentalObject?.type || '',
            adress: block.rentalObject?.address || '',
            fastighet: block.property?.name || '',
            distrikt: block.distrikt || '',
            orsak: block.blockReason || '',
            startdatum: block.fromDate
              ? new Date(block.fromDate).toLocaleDateString('sv-SE')
              : '',
            slutdatum: block.toDate
              ? new Date(block.toDate).toLocaleDateString('sv-SE')
              : '',
            hyra: block.rentalObject?.monthlyRent
              ? Math.round(block.rentalObject.monthlyRent)
              : null,
            hyresbortfall: block.amount ?? null,
          })
        }

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer()

        // Set response headers for file download
        const timestamp = new Date().toISOString().split('T')[0]
        ctx.set(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        ctx.set(
          'Content-Disposition',
          `attachment; filename="sparrlista-${timestamp}.xlsx"`
        )
        ctx.status = 200
        ctx.body = buffer
      } catch (err) {
        logger.error(err, 'Error exporting rental blocks to Excel')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /residences/rental-blocks/search:
   *   get:
   *     summary: Search rental blocks with server-side filtering
   *     description: Search and filter rental blocks with pagination. Supports free-text search and field filters.
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Search term (min 3 chars). Searches across rentalId, address, propertyName, blockReason
   *       - in: query
   *         name: fields
   *         schema:
   *           type: string
   *         description: Comma-separated fields to search (default rentalId,address,propertyName,blockReason)
   *       - in: query
   *         name: kategori
   *         schema:
   *           type: string
   *           enum: [Bostad, Bilplats, Lokal, Förråd, Övrigt]
   *         description: Filter by category
   *       - in: query
   *         name: distrikt
   *         schema:
   *           type: string
   *         description: Filter by district
   *       - in: query
   *         name: blockReason
   *         schema:
   *           type: string
   *         description: Filter by block reason
   *       - in: query
   *         name: fromDateGte
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter blocks starting on or after this date
   *       - in: query
   *         name: toDateLte
   *         schema:
   *           type: string
   *           format: date
   *         description: Filter blocks ending on or before this date
   *       - in: query
   *         name: active
   *         schema:
   *           type: boolean
   *         description: Filter by active status. true = not yet ended (toDate >= today or null), false = already ended (toDate < today). If omitted, all blocks.
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
   *           maximum: 1000
   *           default: 50
   *     responses:
   *       200:
   *         description: Successfully searched rental blocks
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalBlockWithRentalObject'
   *                 _meta:
   *                   type: object
   *                   properties:
   *                     totalRecords:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     count:
   *                       type: integer
   *                 _links:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       href:
   *                         type: string
   *                       rel:
   *                         type: string
   *                         enum: [self, first, last, prev, next]
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/residences/rental-blocks/search',
    parseRequest({ query: searchRentalBlocksQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { page, limit, active, ...searchParams } = ctx.request.parsedQuery
      const offset = (page - 1) * limit

      try {
        const { data: rentalBlocks, totalCount } = await searchRentalBlocks({
          ...searchParams,
          active,
          limit,
          offset,
        })

        // Build additional params for pagination links
        const additionalParams: Record<string, string> = {}
        if (active !== undefined) {
          additionalParams.active = String(active)
        }
        if (searchParams.q) additionalParams.q = searchParams.q
        if (searchParams.fields) additionalParams.fields = searchParams.fields
        if (searchParams.kategori)
          additionalParams.kategori = searchParams.kategori
        if (searchParams.distrikt)
          additionalParams.distrikt = searchParams.distrikt
        if (searchParams.blockReason)
          additionalParams.blockReason = searchParams.blockReason
        if (searchParams.fastighet)
          additionalParams.fastighet = searchParams.fastighet
        if (searchParams.fromDateGte)
          additionalParams.fromDateGte = searchParams.fromDateGte
        if (searchParams.toDateLte)
          additionalParams.toDateLte = searchParams.toDateLte

        ctx.status = 200
        ctx.body = {
          ...buildPaginatedResponse({
            content: rentalBlocks,
            totalRecords: totalCount,
            ctx,
            additionalParams,
            defaultLimit: 50,
          }),
          ...metadata,
        }
      } catch (err) {
        logger.error(err, 'Error searching rental blocks')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /residences/rental-blocks/all:
   *   get:
   *     summary: Get all rental blocks (paginated)
   *     description: Returns paginated rental blocks for residences across the system with HATEOAS links
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: query
   *         name: active
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Filter rental blocks by active status. true = not yet ended (toDate >= today or null), false = already ended (toDate < today). If omitted, include all blocks.
   *       - in: query
   *         name: page
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number (1-indexed)
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 1000
   *           default: 20
   *         description: Number of results per page
   *     responses:
   *       200:
   *         description: Successfully retrieved all rental blocks
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RentalBlockWithRentalObject'
   *                 _meta:
   *                   type: object
   *                   properties:
   *                     totalRecords:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     count:
   *                       type: integer
   *                 _links:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       href:
   *                         type: string
   *                       rel:
   *                         type: string
   *                         enum: [self, first, last, prev, next]
   *       500:
   *         description: Internal server error
   */
  router.get(
    '(.*)/residences/rental-blocks/all',
    parseRequest({ query: getAllRentalBlocksQueryParamsSchema }),
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const { active, page, limit } = ctx.request.parsedQuery
      const offset = (page - 1) * limit

      try {
        const { data: rentalBlocks, totalCount } = await getAllRentalBlocks({
          active,
          limit,
          offset,
        })

        // Build paginated response with HATEOAS links
        const additionalParams: Record<string, string> = {}
        if (active !== undefined) {
          additionalParams.active = String(active)
        }

        ctx.status = 200
        ctx.body = {
          ...buildPaginatedResponse({
            content: rentalBlocks,
            totalRecords: totalCount,
            ctx,
            additionalParams,
            defaultLimit: 20,
          }),
          ...metadata,
        }
      } catch (err) {
        logger.error(err, 'Error fetching all rental blocks')
        ctx.status = 500
        const errorMessage =
          err instanceof Error ? err.message : 'unknown error'
        ctx.body = { reason: errorMessage, ...metadata }
      }
    }
  )

  /**
   * @swagger
   * /residences/block-reasons:
   *   get:
   *     summary: Get all block reasons
   *     description: Returns all available block reasons for rental blocks. Used for filtering dropdowns.
   *     tags:
   *       - Residences
   *     responses:
   *       200:
   *         description: Successfully retrieved block reasons
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/BlockReason'
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/residences/block-reasons', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    try {
      const blockReasons = await getAllBlockReasons()

      ctx.status = 200
      ctx.body = {
        content: blockReasons.map((br: { id: string; caption: string }) => ({
          id: br.id,
          caption: br.caption,
        })),
        ...metadata,
      }
    } catch (err) {
      logger.error(err, 'Error fetching block reasons')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })

  /**
   * @swagger
   * /residences/{id}:
   *   get:
   *     summary: Get a residence by ID
   *     description: Returns a residence with the specified ID
   *     tags:
   *       - Residences
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the residence
   *       - in: query
   *         name: active
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Filter rental blocks by active status. true = not yet ended (toDate >= today or null), false = already ended (toDate < today). If omitted, include all blocks.
   *     responses:
   *       200:
   *         description: Successfully retrieved the residence
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 content:
   *                   $ref: '#/components/schemas/ResidenceDetails'
   *       404:
   *         description: Residence not found
   *       500:
   *         description: Internal server error
   */
  router.get('(.*)/residences/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const id = ctx.params.id
    const activeParam = ctx.query.active as string | undefined
    const active =
      activeParam === 'true'
        ? true
        : activeParam === 'false'
          ? false
          : undefined

    try {
      const residence = await getResidenceById(id, { active })
      if (!residence) {
        ctx.status = 404
        return
      }
      // TODO: find out why building is null in residence

      const rentalId =
        residence.propertyObject?.propertyStructures?.length > 0
          ? residence.propertyObject.propertyStructures[0].rentalId
          : null

      // Get area size for the residence (yta)
      const size = rentalId ? await getResidenceSizeByRentalId(rentalId) : null

      const mappedResidence = {
        id: residence.id,
        code: residence.code,
        name: residence.name,
        location: residence.location,
        floor: residence.floor,
        partNo: residence.partNo,
        part: residence.part,
        deleted: Boolean(residence.deleted),
        accessibility: {
          wheelchairAccessible: Boolean(residence.wheelchairAccessible),
          residenceAdapted: Boolean(residence.residenceAdapted),
          elevator: Boolean(residence.elevator),
        },
        features: {
          balcony1: residence.balcony1Location
            ? {
                location: residence.balcony1Location,
                type: residence.balcony1Type || '',
              }
            : undefined,
          balcony2: residence.balcony2Location
            ? {
                location: residence.balcony2Location,
                type: residence.balcony2Type || '',
              }
            : undefined,
          patioLocation: residence.patioLocation,
          hygieneFacility: residence.hygieneFacility,
          sauna: Boolean(residence.sauna),
          extraToilet: Boolean(residence.extraToilet),
          sharedKitchen: Boolean(residence.sharedKitchen),
          petAllergyFree: Boolean(residence.petAllergyFree),
          electricAllergyIntolerance: Boolean(
            residence.electricAllergyIntolerance
          ),
          smokeFree: Boolean(residence.smokeFree),
          asbestos: Boolean(residence.asbestos),
        },
        validityPeriod: {
          fromDate: residence.fromDate,
          toDate: residence.toDate,
        },
        residenceType: {
          residenceTypeId: residence.residenceType?.id || '',
          code: residence.residenceType?.code || '',
          name: residence.residenceType?.name,
          roomCount: residence.residenceType?.roomCount,
          kitchen: residence.residenceType?.kitchen || 0,
          systemStandard: residence.residenceType?.systemStandard || 0,
          checklistId: residence.residenceType?.checklistId,
          componentTypeActionId: residence.residenceType?.componentTypeActionId,
          statisticsGroupSCBId: residence.residenceType?.statisticsGroupSCBId,
          statisticsGroup2Id: residence.residenceType?.statisticsGroup2Id,
          statisticsGroup3Id: residence.residenceType?.statisticsGroup3Id,
          statisticsGroup4Id: residence.residenceType?.statisticsGroup4Id,
          timestamp:
            residence.residenceType?.timestamp || new Date().toISOString(),
        },
        propertyObject: {
          energy: {
            energyClass: residence.propertyObject?.energyClass || 0,
            energyRegistered:
              residence.propertyObject?.energyRegistered || undefined,
            energyReceived:
              residence.propertyObject?.energyReceived || undefined,
            energyIndex: residence.propertyObject?.energyIndex?.toNumber(),
          },
          rentalId,
          rentalInformation: !residence.propertyObject?.rentalInformation
            ? null
            : {
                type: {
                  code: residence.propertyObject.rentalInformation
                    .rentalInformationType.code,
                  name: residence.propertyObject.rentalInformation
                    .rentalInformationType.name,
                },
              },
          rentalBlocks:
            residence.propertyObject?.rentalBlocks.map((rb) => {
              return {
                id: rb.id,
                blockReasonId: rb.blockReasonId,
                blockReason: rb.blockReason?.caption ?? null,
                fromDate: rb.fromDate,
                toDate: rb.toDate,
                amount: rb.amount,
              }
            }) || [],
        },
        property: {
          code: residence.propertyObject.propertyStructures[0].propertyCode,
          name: residence.propertyObject.propertyStructures[0].propertyName,
        },
        building: {
          code: residence.propertyObject.propertyStructures[0].buildingCode,
          name: residence.propertyObject.propertyStructures[0].buildingName,
        },
        malarEnergiFacilityId: residence.comments?.[0]?.text || null,
        size: size?.value || null,
      } satisfies ResidenceDetails

      ctx.status = 200
      ctx.body = {
        content: mappedResidence,
        ...metadata,
      }
    } catch (err) {
      logger.error(err, 'Error fetching residence by ID')
      ctx.status = 500
      const errorMessage = err instanceof Error ? err.message : 'unknown error'
      ctx.body = { reason: errorMessage, ...metadata }
    }
  })
}
