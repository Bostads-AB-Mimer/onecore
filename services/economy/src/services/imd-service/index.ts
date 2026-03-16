import { logger } from '@onecore/utilities'
import z from 'zod'
import { getActiveLeasesByRentalObjectCodes } from '../common/adapters/xpand-db-adapter'

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

export const imdService = {
  parseCsv,
  enrichIMDRows,
  IMDRowSchema,
}
