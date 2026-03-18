import { logger } from '@onecore/utilities'
import z from 'zod'

import { getActiveLeasesByRentalObjectCodes } from '../common/adapters/xpand-db-adapter'

/**
 * We assume:
 * - There is no header row
 * - ; delimiter
 * - Field structure:
 *   <rentalObjectCode>, <from>, <to>, <unit>, <unknown>, <unknown>, <volume>, <cost>, <unknown>, <unknown>, <measurementUnit>, <unknown>, <unknown>, <unknown>
 */
type IMDCsv = string

const IMDRowSchema = z.object({
  rentalObjectCode: z.string(), // <rentalObjectCode>
  from: z.coerce.date(), // <from>
  to: z.coerce.date(), // <to>
  unit: z.string(), // <unit>
  volume: z.coerce.number(), // <volume>
  cost: z.coerce.number(), // <cost>
  measurementUnit: z.string(), // <measurementUnit>
})

type IMDRow = z.infer<typeof IMDRowSchema>

type Result<T> = { ok: true; data: T } | { ok: false; error: unknown }

function extractNormalizedCols(line: string) {
  const cols = line.split(';')
  return {
    rentalObjectCode: cols[0],
    from: cols[1],
    to: cols[2],
    unit: cols[3],
    volume: cols[6].replace(',', '.'),
    cost: cols[7].replace(',', '.'),
    measurementUnit: cols[10],
  }
}

function parseCsv(csv: IMDCsv): Result<Array<IMDRow>> {
  try {
    if (csv.trim() === '') {
      return { ok: false, error: new Error('Empty CSV') }
    }

    const lines = csv
      .trim()
      .split('\n')
      .map((line) => IMDRowSchema.parse(extractNormalizedCols(line)))

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
    if (imdRows.length === 0) {
      return { ok: false, error: new Error('No rows to enrich') }
    }

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

const UNIT_CONFIG: Record<string, { articleCode: string; description: string }> = {
  VV: { articleCode: 'IMDM', description: 'Varmvatten' },
  VMM: { articleCode: 'VÄRMEENERGIM', description: 'Värmeenergi' },
}

const SWEDISH_MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

const CSV_HEADER = 'Kontraktsnummer;Hyresartikel;Avitext;Fr.o.m;T.o.m;Årshyra'

function getUnitConfig(unit: string) {
  const config = UNIT_CONFIG[unit]
  if (!config) {
    throw new Error(`Unknown unit "${unit}" — no mapping exists`)
  }
  return config
}

function buildInvoiceText(row: EnrichedIMDRow, description: string): string {
  const month = SWEDISH_MONTHS[row.from.getMonth()]
  const volume = row.volume.toString().replace('.', ',')
  return `${description} ${month},${volume},${row.measurementUnit}(25% moms tillkommer)`
}

function toTenfastCsv(rows: Array<EnrichedIMDRow>): string {
  const lines = rows.map((row) => {
    const { articleCode, description } = getUnitConfig(row.unit)
    const yearlyRent = (row.cost * 12).toFixed(2).replace('.', ',')
    return [
      row.leaseId,
      articleCode,
      buildInvoiceText(row, description),
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

// TODO: To small belopp should not be processed
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
