import { logger } from '@onecore/utilities'
import z from 'zod'

import { getActiveLeasesByRentalObjectCodes } from '../common/adapters/xpand-db-adapter'
import { updateLeaseInvoiceRows } from '../../common/adapters/tenfast/tenfast-adapter'

/**
 * We assume:
 * - There is no header row
 * - ; delimiter
 * - Field structure:
 *   <rentalObjectCode>, <from>, <to>, <unit>, <unknown>, <unknown>, <volume>, <cost>, <unknown>, <unknown>, <unknown>, <unknown>, <unknown>, <unknown>
 */
type IMDCsv = string

const IMDRowSchema = z.object({
  rentalObjectCode: z.string(), // <rentalObjectCode>
  from: z.coerce.date(), // <from>
  to: z.coerce.date(), // <to>
  unit: z.string(), // <unit>
  volume: z.coerce.number(), // <volume>
  cost: z.coerce.number(), // <cost>
})

type IMDRow = z.infer<typeof IMDRowSchema>

type Result<T> = { ok: true; data: T } | { ok: false; error: unknown }

function extractNormalizedCols(
  line: string
): [
  rentalObjectCode: string,
  from: string,
  to: string,
  unit: string,
  volume: string,
  cost: string,
] {
  const [rentalObjectCode, from, to, unit, volume, cost] = line.split(';')
  return [
    rentalObjectCode,
    from,
    to,
    unit,
    volume.replace(',', '.'),
    cost.replace(',', '.'),
  ]
}

function parseCsv(csv: IMDCsv): Result<Array<IMDRow>> {
  try {
    const lines = csv
      .trim()
      .split('\n')
      .map((line) => {
        const [rentalObjectCode, from, to, unit, volume, cost] =
          extractNormalizedCols(line)

        return IMDRowSchema.parse({
          rentalObjectCode,
          from,
          to,
          unit,
          volume,
          cost,
        })
      })

    return { ok: true, data: lines }
  } catch (err) {
    logger.error(err)
    return { ok: false, error: err }
  }
}

type EnrichedIMDRow = IMDRow & {
  leaseId: string
}

type UnmatchedIMDRow = IMDRow & {
  reason: 'no-rental-object' | 'no-active-lease'
}

type EnrichResult = {
  enriched: Array<EnrichedIMDRow>
  unmatched: Array<UnmatchedIMDRow>
}

async function enrichIMDRows(
  imdRows: Array<IMDRow>
): Promise<Result<EnrichResult>> {
  try {
    const period = {
      start: imdRows[0].from,
      end: imdRows[0].to,
    }

    const leaseMap = await getActiveLeasesByRentalObjectCodes({
      rentalObjectCodes: imdRows.map((row) => row.rentalObjectCode),
      periodStart: period.start,
      periodEnd: period.end,
    })

    const enriched: Array<EnrichedIMDRow> = []
    const unmatched: Array<UnmatchedIMDRow> = []

    for (const row of imdRows) {
      const lookup = leaseMap.get(row.rentalObjectCode)

      if (lookup === undefined) {
        unmatched.push({ ...row, reason: 'no-rental-object' })
      } else if (lookup === null) {
        unmatched.push({ ...row, reason: 'no-active-lease' })
      } else {
        enriched.push({ ...row, leaseId: lookup })
      }
    }

    return { ok: true, data: { enriched, unmatched } }
  } catch (err) {
    logger.error(err)
    return { ok: false, error: err }
  }
}

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 500

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type AddRentRowsResult = {
  succeeded: Array<{ leaseId: string; rentalObjectCode: string }>
  failed: Array<{ leaseId: string; rentalObjectCode: string; error: string }>
}

async function addRentRows(
  rows: Array<EnrichedIMDRow>,
  articleId: string,
  label: string
): Promise<AddRentRowsResult> {
  const chunks = chunkArray(rows, BATCH_SIZE)
  const succeeded: AddRentRowsResult['succeeded'] = []
  const failed: AddRentRowsResult['failed'] = []

  for (let i = 0; i < chunks.length; i++) {
    await Promise.allSettled(
      chunks[i].map(async (row) => {
        try {
          const res = await updateLeaseInvoiceRows({
            leaseId: row.leaseId,
            rowsToDelete: [],
            rowsToAdd: [
              {
                amount: row.cost,
                vat: 0,
                from: formatDate(row.from),
                to: formatDate(row.to),
                article: articleId,
                label,
              },
            ],
          })

          if (res.ok) {
            succeeded.push({
              leaseId: row.leaseId,
              rentalObjectCode: row.rentalObjectCode,
            })
          } else {
            failed.push({
              leaseId: row.leaseId,
              rentalObjectCode: row.rentalObjectCode,
              error: res.err,
            })
          }
        } catch (err) {
          failed.push({
            leaseId: row.leaseId,
            rentalObjectCode: row.rentalObjectCode,
            error: String(err),
          })
        }
      })
    )

    logger.info(
      `IMD batch ${i + 1}/${chunks.length}: ${succeeded.length} succeeded, ${failed.length} failed`
    )

    if (i < chunks.length - 1) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return { succeeded, failed }
}

export const imdService = {
  parseCsv,
  enrichIMDRows,
  addRentRows,
  IMDRowSchema,
}
