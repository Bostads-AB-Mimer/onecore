import KoaRouter from '@koa/router'
import {
  createExcelFromPaginated,
  generateRouteMetadata,
  logger,
  setExcelDownloadHeaders,
} from '@onecore/utilities'
import type { property } from '@onecore/types'

import * as propertyBaseAdapter from '../../adapters/property-base-adapter'
import { parseQuery } from '../../utils/route-helpers'
import { SearchRentalObjectsQuerySchema } from './rental-objects'

const PAGE_SIZE = 500
// The details endpoint caps rentalIds at 200, so a page is looked up in chunks.
const DETAILS_CHUNK = 200

const TYPE_LABELS: Record<property.RentalObjectType, string> = {
  residence: 'Bostad',
  parkingSpace: 'Bilplats',
  facility: 'Lokal',
  other: 'Övrigt',
}

type ExportRow = property.RentalObjectSummary & {
  details: property.RentalObjectDetails | undefined
}

/** Grundhyra is monthly; per-m² is quoted yearly, as rents are in Sweden. */
const rentPerArea = (
  rent: number | null | undefined,
  area: number | null | undefined
) => (rent == null || !area ? null : Math.round((rent * 12) / area))

/** Details are best-effort: a failed lookup blanks the columns, not the file. */
async function fetchDetails(
  rentalIds: string[]
): Promise<Map<string, property.RentalObjectDetails>> {
  const byId = new Map<string, property.RentalObjectDetails>()
  for (let i = 0; i < rentalIds.length; i += DETAILS_CHUNK) {
    const chunk = rentalIds.slice(i, i + DETAILS_CHUNK)
    const result = await propertyBaseAdapter.getRentalObjectDetails({
      rentalIds: chunk,
    })
    if (!result.ok) {
      logger.error(
        { err: result.err, count: chunk.length },
        'rental-objects-export: details lookup failed'
      )
      continue
    }
    for (const d of result.data) byId.set(d.rentalId, d)
  }
  return byId
}

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /rental-objects/search/export:
   *   get:
   *     summary: Export a rental-object search as Excel
   *     description: |
   *       Every rental object the search would return, across all pages, as an
   *       .xlsx with the listing values (grundhyra, BRA, annan information,
   *       anläggnings-ID) filled in. Takes the search's scopes and filters;
   *       page and limit are ignored.
   *     tags:
   *       - Rental objects
   *     parameters:
   *       - { in: query, name: costCenterIds, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: kvvAreaIds, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: marketAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: propertyCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: buildingCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: staircaseCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: parkingAreaCodes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: rentalIds, schema: { type: array, items: { type: string } }, description: 'Individually picked objects, max 200' }
   *       - { in: query, name: types, schema: { type: array, items: { type: string, enum: [residence, parkingSpace, facility, other] } } }
   *       - { in: query, name: subtypes, schema: { type: array, items: { type: string } } }
   *       - { in: query, name: q, schema: { type: string } }
   *     responses:
   *       200:
   *         description: Excel file
   *         content:
   *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: Invalid query parameters
   *       500:
   *         description: Internal server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('(.*)/rental-objects/search/export', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    // Same schema as the search; the export walks every page itself.
    const query = parseQuery(ctx, SearchRentalObjectsQuerySchema, metadata)
    if (!query) return

    try {
      const buffer = await createExcelFromPaginated<ExportRow>(
        async (page, limit) => {
          const result = await propertyBaseAdapter.searchRentalObjects({
            ...query,
            page,
            limit,
          })
          if (!result.ok) throw new Error(`search failed: ${result.err}`)

          const { content, totalCount } = result.data
          const detailsById = await fetchDetails(content.map((o) => o.rentalId))
          return {
            content: content.map((o) => ({
              ...o,
              details: detailsById.get(o.rentalId),
            })),
            _meta: {
              totalRecords: totalCount,
              page,
              limit,
              count: content.length,
            },
            _links: [],
          }
        },
        {
          sheetName: 'Hyresobjekt',
          columns: [
            { header: 'Objektnummer', key: 'rentalId', width: 18 },
            { header: 'Postadress', key: 'address', width: 30 },
            { header: 'Grundhyra', key: 'baseRent', width: 12 },
            { header: 'BRA', key: 'area', width: 10 },
            { header: 'Grundhyra per m²/år', key: 'rentPerArea', width: 18 },
            { header: 'Hyresobjekttyp', key: 'type', width: 14 },
            { header: 'Undertyp', key: 'subtypeName', width: 22 },
            { header: 'Fastighetsbeteckning', key: 'propertyName', width: 24 },
            { header: 'Fastighetskod', key: 'propertyCode', width: 14 },
            { header: 'Byggnad', key: 'buildingCode', width: 14 },
            { header: 'Trapphus', key: 'staircaseName', width: 16 },
            {
              header: 'Annan information av vikt',
              key: 'additionalInfo',
              width: 40,
            },
            { header: 'Anläggnings ID', key: 'malarEnergiFacilityId', width: 16 },
          ],
          rowMapper: (o) => ({
            rentalId: o.rentalId,
            address: o.address ?? '',
            baseRent: o.details?.baseRent ?? null,
            area: o.details?.area ?? null,
            rentPerArea: rentPerArea(o.details?.baseRent, o.details?.area),
            type: TYPE_LABELS[o.type],
            subtypeName: o.subtypeName ?? '',
            propertyName: o.propertyName ?? '',
            propertyCode: o.propertyCode ?? '',
            buildingCode: o.buildingCode ?? '',
            staircaseName: o.staircaseName ?? '',
            additionalInfo: o.details?.additionalInfo ?? '',
            malarEnergiFacilityId: o.details?.malarEnergiFacilityId ?? '',
          }),
          batchSize: PAGE_SIZE,
        }
      )

      setExcelDownloadHeaders(ctx, 'hyresobjekt')
      ctx.body = buffer
    } catch (err) {
      logger.error({ err, query }, 'rental-objects-export: failed to build Excel')
      ctx.status = 500
      ctx.body = { reason: 'Internal server error', ...metadata }
    }
  })
}
