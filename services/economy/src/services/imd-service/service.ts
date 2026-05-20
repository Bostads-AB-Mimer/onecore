import { logger } from '@onecore/utilities'
import { economy } from '@onecore/types'

import {
  getActiveLeasesByRentalObjectCodes,
  type LeaseMatch,
  type MultipleLeaseMatch,
} from '../../common/adapters/tenfast/tenfast-adapter'

import z from 'zod'

type IMDRow = z.infer<typeof economy.IMDRowSchema>

type ProcessIMDError = 'invalid-csv' | 'processing-failed'

type Result<T> = { ok: true; data: T } | { ok: false; reason: ProcessIMDError }

const MIN_COLUMNS = 11

// Assumes semicolon-delimited CSV with at least 11 columns:
// 0: rentalObjectCode, 1: from, 2: to, 3: unit, 6: volume, 7: cost, 10: measurementUnit
function extractNormalizedCols(line: string, lineIndex: number) {
  const cols = line.split(';')
  if (cols.length < MIN_COLUMNS) {
    throw new Error(
      `CSV line ${lineIndex + 1} has ${cols.length} columns, expected at least ${MIN_COLUMNS}`
    )
  }
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

function parseCsv(csv: string): Result<Array<IMDRow>> {
  try {
    if (csv.trim() === '') {
      return { ok: false, reason: 'invalid-csv' }
    }

    const lines = csv
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim()
      .split('\n')
      .map((line, i) =>
        economy.IMDRowSchema.parse(extractNormalizedCols(line, i))
      )

    const firstFrom = lines[0].from.toISOString()
    const firstTo = lines[0].to.toISOString()
    const mixedPeriod = lines.some(
      (row) =>
        row.from.toISOString() !== firstFrom || row.to.toISOString() !== firstTo
    )
    if (mixedPeriod) {
      logger.warn('IMD: CSV contains rows with different periods')
      return { ok: false, reason: 'invalid-csv' }
    }

    return { ok: true, data: lines }
  } catch (err) {
    logger.error(err, 'IMD: Failed to parse CSV')
    return { ok: false, reason: 'invalid-csv' }
  }
}

type EnrichedIMDRow = IMDRow & {
  leaseId: string
}

type UnprocessedIMDRow = IMDRow &
  (
    | { reason: 'no-rental-object' }
    | { reason: 'no-active-lease' }
    | { reason: 'amount-too-low' }
    | { reason: 'tenant-moved' }
    | { reason: 'multiple-leases'; leaseIds: string[] }
    | { reason: 'unsupported-unit' }
  )

type UnprocessedReason = UnprocessedIMDRow['reason']

const MIN_COST = 15

function isMultipleLeaseMatch(
  m: LeaseMatch | MultipleLeaseMatch
): m is MultipleLeaseMatch {
  return 'leaseIds' in m
}

function hasTenantMoved(lease: LeaseMatch, asOf: Date): boolean {
  return lease.leaseEndDate !== null && lease.leaseEndDate < asOf
}

type EnrichResult = {
  enriched: Array<EnrichedIMDRow>
  unprocessed: Array<UnprocessedIMDRow>
}

function classifyRows(
  rows: Array<IMDRow>,
  leaseMap: Map<string, LeaseMatch | MultipleLeaseMatch | null>,
  today: Date
): EnrichResult {
  return rows.reduce<EnrichResult>(
    (acc, row) => {
      if (row.cost < MIN_COST) {
        acc.unprocessed.push({ ...row, reason: 'amount-too-low' })
        return acc
      }
      const lookup = leaseMap.get(row.rentalObjectCode)
      if (lookup === undefined) {
        acc.unprocessed.push({ ...row, reason: 'no-rental-object' })
      } else if (lookup === null) {
        acc.unprocessed.push({ ...row, reason: 'no-active-lease' })
      } else if (isMultipleLeaseMatch(lookup)) {
        acc.unprocessed.push({
          ...row,
          reason: 'multiple-leases',
          leaseIds: lookup.leaseIds,
        })
      } else if (hasTenantMoved(lookup, today)) {
        acc.unprocessed.push({ ...row, reason: 'tenant-moved' })
      } else if (!UNIT_CONFIG[row.unit]) {
        acc.unprocessed.push({ ...row, reason: 'unsupported-unit' })
      } else {
        acc.enriched.push({ ...row, leaseId: lookup.leaseId })
      }
      return acc
    },
    { enriched: [], unprocessed: [] }
  )
}

async function enrichIMDRows(
  imdRows: Array<IMDRow>
): Promise<Result<EnrichResult>> {
  try {
    if (imdRows.length === 0) {
      return { ok: false, reason: 'invalid-csv' }
    }

    const period = { start: imdRows[0].from, end: imdRows[0].to }

    const eligibleCodes = [
      ...new Set(
        imdRows
          .filter((row) => row.cost >= MIN_COST)
          .map((row) => row.rentalObjectCode)
      ),
    ]
    const leaseMap = await getActiveLeasesByRentalObjectCodes({
      rentalObjectCodes: eligibleCodes,
      periodStart: period.start,
      periodEnd: period.end,
    })

    const { enriched, unprocessed } = classifyRows(
      imdRows,
      leaseMap,
      new Date()
    )

    return { ok: true, data: { enriched, unprocessed } }
  } catch (err) {
    logger.error(err, 'IMD: Enrichment failed')
    return { ok: false, reason: 'processing-failed' }
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const UNIT_CONFIG: Record<
  string,
  { articleCode: string; description: string }
> = {
  VV: { articleCode: 'IMDM', description: 'Varmvatten' },
  VMM: { articleCode: 'VÄRMEENERGIM', description: 'Värmeenergi' },
}

const SWEDISH_MONTHS = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
]

// RFC 4180: quote fields that contain the delimiter, double-quotes, or newlines
function csvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(',')
}

const CSV_HEADER = csvRow([
  'Kontraktsnummer',
  'Hyresartikel',
  'Avitext',
  'Fr.o.m',
  'T.o.m',
  'Årshyra',
  'Summarad',
])

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
    return csvRow([
      row.leaseId,
      articleCode,
      buildInvoiceText(row, description),
      formatDate(row.from),
      formatDate(row.to),
      yearlyRent,
      '',
    ])
  })

  return [CSV_HEADER, ...lines].join('\n')
}

const UNPROCESSED_CSV_HEADER = csvRow([
  'Hyresobjektskod',
  'Fr.o.m',
  'T.o.m',
  'Enhet',
  'Volym',
  'Kostnad',
  'Måttenhet',
  'Orsak',
])

// 'multiple-leases' and 'unsupported-unit' are handled dynamically in getReasonLabel
const REASON_LABELS: Record<
  Exclude<UnprocessedReason, 'multiple-leases' | 'unsupported-unit'>,
  string
> = {
  'no-rental-object': 'Hyresobjekt saknas i Tenfast',
  'no-active-lease': 'Inget aktivt kontrakt i perioden',
  'amount-too-low': 'Belopp under 15 kr',
  'tenant-moved': 'Hyresgästen har avslutat kontrakt efter perioden',
}

function getReasonLabel(row: UnprocessedIMDRow): string {
  if (row.reason === 'multiple-leases') {
    return `Flera kontrakt matchar perioden: ${row.leaseIds.join(', ')}`
  }
  if (row.reason === 'unsupported-unit') {
    return `Enhet stöds ej: ${row.unit}`
  }
  return REASON_LABELS[row.reason]
}

function toUnprocessedCsv(rows: Array<UnprocessedIMDRow>): string {
  const lines = rows.map((row) => {
    const volume = row.volume.toString().replace('.', ',')
    const cost = row.cost.toString().replace('.', ',')
    return csvRow([
      row.rentalObjectCode,
      formatDate(row.from),
      formatDate(row.to),
      row.unit,
      volume,
      cost,
      row.measurementUnit,
      getReasonLabel(row),
    ])
  })

  return [UNPROCESSED_CSV_HEADER, ...lines].join('\n')
}

function generateCsvOutput(
  enriched: Array<EnrichedIMDRow>,
  unprocessed: Array<UnprocessedIMDRow>
): Result<{ enrichedCsv: string; unprocessedCsv: string }> {
  try {
    return {
      ok: true,
      data: {
        enrichedCsv: toTenfastCsv(enriched),
        unprocessedCsv: toUnprocessedCsv(unprocessed),
      },
    }
  } catch (err) {
    logger.error(err, 'IMD: Failed to generate CSV output')
    return { ok: false, reason: 'processing-failed' }
  }
}

type ProcessResult = {
  totalRows: number
  enriched: number
  unprocessed: Array<UnprocessedIMDRow>
  enrichedCsv: string
  unprocessedCsv: string
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

  const { enriched, unprocessed } = enrichResult.data
  logger.info(
    `IMD: Enrichment complete — ${enriched.length} matched, ${unprocessed.length} unprocessed`
  )

  const csvResult = generateCsvOutput(enriched, unprocessed)
  if (!csvResult.ok) {
    return csvResult
  }
  const { enrichedCsv, unprocessedCsv } = csvResult.data

  logger.info(
    {
      totalRows: rows.length,
      enriched: enriched.length,
      unprocessed: unprocessed.length,
    },
    'IMD: Processing complete'
  )

  return {
    ok: true,
    data: {
      totalRows: rows.length,
      enriched: enriched.length,
      unprocessed,
      enrichedCsv,
      unprocessedCsv,
    },
  }
}

export const imdService = {
  parseCsv,
  enrichIMDRows,
  toTenfastCsv,
  toUnprocessedCsv,
  processIMD,
}
