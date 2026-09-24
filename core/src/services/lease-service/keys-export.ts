import KoaRouter from '@koa/router'
import {
  createExcelFromPaginated,
  formatDateForExcel,
  generateRouteMetadata,
  logger,
  setExcelDownloadHeaders,
} from '@onecore/utilities'
import { z } from 'zod'
import { leasing, LeaseStatusLabel } from '@onecore/types'

import { KeysApi } from '../../adapters/keys-adapter'
import * as leasingAdapter from '../../adapters/leasing-adapter'

const querySchema = z.object({
  property: z.string().min(1),
  buildingCode: z.string().optional(),
})

const KEYS_CONCURRENCY = 5
const PAGE_SIZE = 100

type EnrichedLease = leasing.v1.LeaseSearchResult & {
  keyName: string
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = cursor++
        if (index >= items.length) return
        results[index] = await worker(items[index])
      }
    }
  )

  await Promise.all(runners)
  return results
}

async function enrichLeasesWithKeys(
  leases: leasing.v1.LeaseSearchResult[]
): Promise<EnrichedLease[]> {
  const enriched: EnrichedLease[] = leases.map((lease) => ({
    ...lease,
    keyName: '',
  }))

  let attempted = 0
  let failed = 0
  let empty = 0
  let withKeys = 0

  await runWithConcurrency(
    enriched,
    async (lease) => {
      if (!lease.rentalObjectCode) return
      attempted++
      const result = await KeysApi.getByRentalObjectCode(lease.rentalObjectCode)
      if (!result.ok) {
        failed++
        logger.error(
          { err: result.err, rentalObjectCode: lease.rentalObjectCode },
          'leases-keys-export: keys lookup failed'
        )
        return
      }
      const keyNames = Array.from(
        new Set(
          result.data
            .map((k) => k.keyName)
            .filter((name): name is string => Boolean(name))
        )
      )
      if (keyNames.length === 0) {
        empty++
      } else {
        withKeys++
        lease.keyName = keyNames.join(', ')
      }
    },
    KEYS_CONCURRENCY
  )

  logger.info(
    { attempted, failed, empty, withKeys },
    'leases-keys-export: keys lookup summary'
  )

  return enriched
}

export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /leases/keys-export:
   *   get:
   *     summary: Export all leases for a property as Excel, enriched with key name(s)
   *     description: |
   *       Returns an .xlsx file with one row per lease matching the property filter,
   *       enriched with the key name(s) from the keys service.
   *       Optional buildingCode filter narrows to a single building.
   *     tags: [Leases]
   *     parameters:
   *       - in: query
   *         name: property
   *         required: true
   *         schema:
   *           type: string
   *         description: Property designation (fastighetsbeteckning), e.g. "ALLMOGEKULTUREN 1"
   *       - in: query
   *         name: buildingCode
   *         required: false
   *         schema:
   *           type: string
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
   *         description: Server error
   *     security:
   *       - bearerAuth: []
   */
  router.get('/leases/keys-export', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, ['property', 'buildingCode'])

    const queryParsed = querySchema.safeParse(ctx.query)
    if (!queryParsed.success) {
      ctx.status = 400
      ctx.body = { error: 'Invalid query parameters', ...metadata }
      return
    }
    const { property, buildingCode } = queryParsed.data

    try {
      const buffer = await createExcelFromPaginated<EnrichedLease>(
        async (page, limit, totalCount) => {
          const response = await leasingAdapter.searchLeases({
            property: [property],
            ...(buildingCode ? { buildingCodes: [buildingCode] } : {}),
            forExport: 'true',
            page: String(page),
            limit: String(limit),
            ...(totalCount !== undefined
              ? { totalCount: String(totalCount) }
              : {}),
          })

          const enriched = await enrichLeasesWithKeys(response.content)
          return { ...response, content: enriched }
        },
        {
          sheetName: 'Nycklar',
          columns: [
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Kontraktsnummer', key: 'leaseId', width: 22 },
            { header: 'Nyckelnamn', key: 'keyName', width: 22 },
            {
              header: 'Hyresgäst 1, benämning',
              key: 'tenantOneName',
              width: 30,
            },
            { header: 'Hyresgäst 1', key: 'tenantOneCode', width: 14 },
            { header: 'Hyresgäst 1, e-post', key: 'tenantOneEmail', width: 32 },
            {
              header: 'Hyresgäst 1, telefonnummer',
              key: 'tenantOnePhone',
              width: 22,
            },
            {
              header: 'Hyresgäst 2, benämning',
              key: 'tenantTwoName',
              width: 30,
            },
            { header: 'Hyresgäst 2', key: 'tenantTwoCode', width: 14 },
            { header: 'Hyresobjekt', key: 'rentalObjectCode', width: 22 },
            { header: 'Adress', key: 'address', width: 30 },
            { header: 'Objekttyp', key: 'objectTypeCode', width: 12 },
            { header: 'Fastighet', key: 'property', width: 22 },
            { header: 'Byggnad', key: 'buildingCode', width: 14 },
            { header: 'Distrikt', key: 'districtName', width: 18 },
            { header: 'Kontraktstyp', key: 'leaseType', width: 18 },
            { header: 'Startdatum', key: 'startDate', width: 14 },
            {
              header: 'Sista debiteringsdatum',
              key: 'lastDebitDate',
              width: 14,
            },
            { header: 'Årshyra', key: 'yearRent', width: 12 },
          ],
          rowMapper: (lease) => {
            const contacts = lease.contacts ?? []
            const tenantOne = contacts[0]
            const tenantTwo = contacts[1]
            return {
              status: LeaseStatusLabel[lease.status] ?? '',
              leaseId: lease.leaseId,
              keyName: lease.keyName,
              tenantOneName: tenantOne?.name ?? '',
              tenantOneCode: tenantOne?.contactCode ?? '',
              tenantOneEmail: tenantOne?.email ?? '',
              tenantOnePhone: tenantOne?.phone ?? '',
              tenantTwoName: tenantTwo?.name ?? '',
              tenantTwoCode: tenantTwo?.contactCode ?? '',
              rentalObjectCode: lease.rentalObjectCode ?? '',
              address: lease.address ?? '',
              objectTypeCode: lease.objectTypeCode,
              property: lease.property ?? '',
              buildingCode: lease.buildingCode ?? '',
              districtName: lease.districtName ?? '',
              leaseType: lease.leaseType,
              startDate: formatDateForExcel(lease.startDate),
              lastDebitDate: formatDateForExcel(lease.lastDebitDate),
              yearRent:
                typeof lease.totalYearRent === 'number'
                  ? Math.round(lease.totalYearRent)
                  : '',
            }
          },
          batchSize: PAGE_SIZE,
        }
      )

      const filenameSuffix = buildingCode
        ? `${property}-${buildingCode}`
        : property
      setExcelDownloadHeaders(ctx, `nycklar-${filenameSuffix}`)
      ctx.body = buffer
    } catch (err) {
      logger.error(
        { err, property, buildingCode },
        'leases-keys-export: failed to build Excel'
      )
      ctx.status = 500
      ctx.body = { error: 'Failed to build keys export', ...metadata }
    }
  })
}
