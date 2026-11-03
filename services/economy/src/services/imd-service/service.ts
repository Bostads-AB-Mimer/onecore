import dayjs from 'dayjs'
import { match } from 'ts-pattern'
import { logger } from '@onecore/utilities'
import { economy } from '@onecore/types'

import {
  getActiveLeasesByRentalObjectCodes,
  getLeasesByTenantId,
  type LeaseMatch,
  type MultipleLeaseMatch,
  type TenantLease,
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
    | { reason: 'duplicate-lease'; leaseId: string }
  )

const MIN_COST = 15

function isMultipleLeaseMatch(
  m: LeaseMatch | MultipleLeaseMatch
): m is MultipleLeaseMatch {
  return 'leaseIds' in m
}

const IMD_BILLING_MONTH_OFFSET = 2

function billingPeriodForConsumption(from: Date): { from: Date; to: Date } {
  const billingMonth = dayjs(from).add(IMD_BILLING_MONTH_OFFSET, 'month')
  return {
    from: billingMonth.startOf('month').toDate(),
    to: billingMonth.endOf('month').toDate(),
  }
}

// Rows are billed IMD_BILLING_MONTH_OFFSET months after consumption, so a
// lease that ends before the billing month is over will never invoice them.
function hasTenantMoved(lease: LeaseMatch, consumptionFrom: Date): boolean {
  const billingPeriod = billingPeriodForConsumption(consumptionFrom)
  return (
    lease.leaseEndDate !== null &&
    dayjs(lease.leaseEndDate).isBefore(billingPeriod.to, 'day')
  )
}

type EnrichResult = {
  enriched: Array<EnrichedIMDRow>
  unprocessed: Array<UnprocessedIMDRow>
}

function classifyRows(
  rows: Array<IMDRow>,
  leaseMap: Map<string, LeaseMatch | MultipleLeaseMatch | null>
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
      } else if (hasTenantMoved(lookup, row.from)) {
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

// Stages of a lease that will be invoiced for the billing month. Leases still
// being signed don't count, nor do ones that are voided or over.
const INVOICEABLE_STAGES = new Set([
  'active',
  'upcoming',
  'terminationScheduled',
  'preTermination',
])

function coversPeriod(
  lease: TenantLease,
  period: { from: Date; to: Date }
): boolean {
  return (
    lease.startDate !== null &&
    !dayjs(lease.startDate).isAfter(period.from, 'day') &&
    (lease.endDate === null || !dayjs(lease.endDate).isBefore(period.to, 'day'))
  )
}

// A tenant who moved from one residential lease to another is billed for the
// old home on the new lease. Anything ambiguous is left for manual handling.
function findNewLease(
  tenantLeases: Array<TenantLease>,
  oldLeaseId: string,
  billingPeriod: { from: Date; to: Date }
): string | null {
  const oldLease = tenantLeases.find((lease) => lease.leaseId === oldLeaseId)
  if (!oldLease?.isResidential) {
    return null
  }

  const candidates = tenantLeases.filter(
    (lease) =>
      lease.leaseId !== oldLeaseId &&
      lease.isResidential &&
      INVOICEABLE_STAGES.has(lease.stage) &&
      coversPeriod(lease, billingPeriod)
  )
  return candidates.length === 1 ? candidates[0].leaseId : null
}

const TENANT_LOOKUP_CONCURRENCY = 5

async function getLeasesByTenantIds(
  tenantIds: Array<string>
): Promise<Map<string, Array<TenantLease> | null>> {
  const results = new Map<string, Array<TenantLease> | null>()
  for (let i = 0; i < tenantIds.length; i += TENANT_LOOKUP_CONCURRENCY) {
    const batch = tenantIds.slice(i, i + TENANT_LOOKUP_CONCURRENCY)
    const responses = await Promise.all(
      batch.map((tenantId) => getLeasesByTenantId(tenantId))
    )
    batch.forEach((tenantId, j) => {
      const response = responses[j]
      if (!response.ok) {
        logger.warn({ tenantId }, 'IMD: Failed to fetch leases for tenant')
      }
      results.set(tenantId, response.ok ? response.data : null)
    })
  }
  return results
}

async function moveToNewLeases(
  result: EnrichResult,
  leaseMap: Map<string, LeaseMatch | MultipleLeaseMatch | null>
): Promise<EnrichResult> {
  // Leases shared by several tenants are left for manual handling, since the
  // tenants may have moved to different homes.
  const candidates = result.unprocessed.flatMap((row) => {
    const lease = leaseMap.get(row.rentalObjectCode)
    if (
      row.reason !== 'tenant-moved' ||
      !UNIT_CONFIG[row.unit] ||
      !lease ||
      isMultipleLeaseMatch(lease) ||
      lease.tenantIds.length !== 1
    ) {
      return []
    }
    return [{ row, oldLeaseId: lease.leaseId, tenantId: lease.tenantIds[0] }]
  })
  if (candidates.length === 0) {
    return result
  }

  const tenantLeases = await getLeasesByTenantIds([
    ...new Set(candidates.map(({ tenantId }) => tenantId)),
  ])

  const moved = candidates.flatMap(({ row, oldLeaseId, tenantId }) => {
    const leases = tenantLeases.get(tenantId)
    const newLeaseId = leases
      ? findNewLease(leases, oldLeaseId, billingPeriodForConsumption(row.from))
      : null
    return newLeaseId ? [{ row, oldLeaseId, newLeaseId }] : []
  })

  for (const { row, oldLeaseId, newLeaseId } of moved) {
    logger.info(
      { rentalObjectCode: row.rentalObjectCode, oldLeaseId, newLeaseId },
      "IMD: Moved row to tenant's new lease"
    )
  }

  const movedRows = new Set<UnprocessedIMDRow>(moved.map(({ row }) => row))
  return {
    enriched: [
      ...result.enriched,
      ...moved.map(({ row, newLeaseId }) => {
        const { reason: _reason, ...imdRow } = row
        return { ...imdRow, leaseId: newLeaseId }
      }),
    ],
    unprocessed: result.unprocessed.filter((row) => !movedRows.has(row)),
  }
}

// Tenfast refuses an import file in which a lease appears more than once, so
// only the first row per lease goes through and the rest are left manual.
// Moved rows come after the rows matched directly, so a home's own row wins
// over one moved to it.
function keepOneRowPerLease(result: EnrichResult): EnrichResult {
  const seen = new Set<string>()
  return result.enriched.reduce<EnrichResult>(
    (acc, row) => {
      if (seen.has(row.leaseId)) {
        const { leaseId, ...imdRow } = row
        logger.info(
          { rentalObjectCode: row.rentalObjectCode, leaseId },
          'IMD: Row left manual, lease already has a row in the file'
        )
        acc.unprocessed.push({ ...imdRow, reason: 'duplicate-lease', leaseId })
      } else {
        seen.add(row.leaseId)
        acc.enriched.push(row)
      }
      return acc
    },
    { enriched: [], unprocessed: [...result.unprocessed] }
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

    const { enriched, unprocessed } = keepOneRowPerLease(
      await moveToNewLeases(classifyRows(imdRows, leaseMap), leaseMap)
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
  ELEC: { articleCode: 'IMDELM', description: 'El' },
  EL: { articleCode: 'IMDELM', description: 'Elförbrukning' },
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
    const billingPeriod = billingPeriodForConsumption(row.from)
    return csvRow([
      row.leaseId,
      articleCode,
      buildInvoiceText(row, description),
      formatDate(billingPeriod.from),
      formatDate(billingPeriod.to),
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

function getReasonLabel(row: UnprocessedIMDRow): string {
  return match(row)
    .with({ reason: 'no-rental-object' }, () => 'Hyresobjekt saknas i Tenfast')
    .with(
      { reason: 'no-active-lease' },
      () => 'Inget aktivt kontrakt i perioden'
    )
    .with({ reason: 'amount-too-low' }, () => 'Belopp under 15 kr')
    .with(
      { reason: 'tenant-moved' },
      () => 'Kontraktet upphör före faktureringsmånadens slut'
    )
    .with(
      { reason: 'multiple-leases' },
      ({ leaseIds }) =>
        `Flera kontrakt matchar perioden: ${leaseIds.join(', ')}`
    )
    .with(
      { reason: 'unsupported-unit' },
      ({ unit }) => `Enhet stöds ej: ${unit}`
    )
    .with(
      { reason: 'duplicate-lease' },
      ({ leaseId }) => `Flera rader för samma kontrakt: ${leaseId}`
    )
    .exhaustive()
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
