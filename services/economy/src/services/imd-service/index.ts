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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const UNIT_CONFIG: Record<string, { articleCode: string; label: string }> = {
  VV: { articleCode: 'IMDM', label: 'Vattenförbrukning' },
  VMM: { articleCode: 'VÄRMEENERGIM', label: 'Värmeenergi' },
}

const CSV_HEADER = 'Kontraktsnummer;Hyresartikel;Avitext;Fr.o.m;T.o.m;Årshyra'

function getUnitConfig(unit: string) {
  const config = UNIT_CONFIG[unit]
  if (!config) {
    throw new Error(`Unknown unit "${unit}" — no mapping exists`)
  }
  return config
}

function toTenfastCsv(rows: Array<EnrichedIMDRow>): string {
  const lines = rows.map((row) => {
    const { articleCode, label } = getUnitConfig(row.unit)
    const yearlyRent = (row.cost * 12).toFixed(2).replace('.', ',')
    return [
      row.leaseId,
      articleCode,
      label,
      formatDate(row.from),
      formatDate(row.to),
      yearlyRent,
    ].join(';')
  })

  return [CSV_HEADER, ...lines].join('\n')
}

type ProcessResult = {
  totalRows: number
  enriched: number
  unmatched: Array<UnmatchedIMDRow>
  csv: string
}

async function processIMD(csv: string): Promise<Result<ProcessResult>> {
  logger.info('IMD: Starting processing')

  const parseResult = parseCsv(csv)
  if (!parseResult.ok) {
    return parseResult
  }

  const rows = parseResult.data
  logger.info(`IMD: Parsed ${rows.length} rows from CSV`)

  const enrichResult = await enrichIMDRows(rows)
  if (!enrichResult.ok) {
    return enrichResult
  }

  const { enriched, unmatched } = enrichResult.data
  logger.info(
    `IMD: Enrichment complete — ${enriched.length} matched, ${unmatched.length} unmatched`
  )

  if (unmatched.length > 0) {
    const noRentalObject = unmatched.filter(
      (r) => r.reason === 'no-rental-object'
    )
    const noActiveLease = unmatched.filter(
      (r) => r.reason === 'no-active-lease'
    )

    if (noRentalObject.length > 0) {
      logger.warn(
        { codes: noRentalObject.map((r) => r.rentalObjectCode) },
        `IMD: ${noRentalObject.length} rows with unknown rental object codes`
      )
    }
    if (noActiveLease.length > 0) {
      logger.warn(
        { codes: noActiveLease.map((r) => r.rentalObjectCode) },
        `IMD: ${noActiveLease.length} rows with no active lease in period`
      )
    }
  }

  const outputCsv = toTenfastCsv(enriched)

  logger.info(
    {
      totalRows: rows.length,
      enriched: enriched.length,
      unmatched: unmatched.length,
    },
    'IMD: Processing complete'
  )

  return {
    ok: true,
    data: {
      totalRows: rows.length,
      enriched: enriched.length,
      unmatched,
      csv: outputCsv,
    },
  }
}

export const imdService = {
  parseCsv,
  enrichIMDRows,
  toTenfastCsv,
  processIMD,
  IMDRowSchema,
}
