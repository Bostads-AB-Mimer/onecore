import knex from 'knex'
import { z } from 'zod'
import { logger } from '@onecore/utilities'

import config from '@src/common/config'
import trimStrings from '@src/utils/trimStrings'
import {
  makeTenfastRequest,
  getInvoiceArticle,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { TenfastInvoiceRowSchema } from '@src/common/adapters/tenfast/schemas'
import { getRentalSpecificRules } from '@src/services/invoice-service/adapters/xpand-db-adapter'

const db = knex({
  connection: {
    host: config.xpandDatabase.host,
    user: config.xpandDatabase.user,
    password: config.xpandDatabase.password,
    port: config.xpandDatabase.port,
    database: config.xpandDatabase.database,
    requestTimeout: 300000,
  },
  pool: { min: 0, max: 5 },
  client: 'mssql',
})

export const closeDb = () => {
  db.destroy()
}

export type ComparisonSide = 'xpand' | 'tenfast'

/**
 * One invoiced rent row, normalized into a comparable shape.
 * netto is the amount excluding vat (credits are negative on both sides).
 */
export type ComparisonRow = {
  side: ComparisonSide
  invoiceNumber: string
  state: string
  customer: string
  contract: string
  rentalObject: string
  property: string
  article: string
  account: string
  text: string
  netto: number
  vat: number
}

export type GroupAggregates = {
  netto: number
  vat: number
  count: number
}

/** Aggregates per key (contract+article unless keyOf says otherwise). */
export type Aggregates = Record<string, GroupAggregates>

export type DiffRow = {
  group: string
  status: string
  xpandNetto: number | ''
  tenfastNetto: number | ''
  diffNetto: number
  xpandVat: number | ''
  tenfastVat: number | ''
  xpandCount: number
  tenfastCount: number
}

export type InvoiceContribution = {
  group: string
  side: ComparisonSide
  invoiceNumber: string
  state: string
  invoiceNetto: number
  invoiceVat: number
  rowCount: number
}

export const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100

export const monthBounds = (
  month: string
): { from: Date; lastDay: string; fromString: string } => {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10))
  const from = new Date(Date.UTC(y, m - 1, 1))
  const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const fromString = `${month}-01`
  return { from, lastDay, fromString }
}

// ---------------------------------------------------------------------------
// Xpand
// ---------------------------------------------------------------------------

type XpandInvoiceRowDbRow = {
  invoiceNumber: string
  invoiceType: number
  debitStatus: number
  headerContract: string | null
  customerCode: string
  rowType: number
  text: string | null
  articleCode: string | null
  amount: number
  reduction: number
  vat: number
}

type XpandInvoice = {
  invoiceNumber: string
  invoiceType: number
  debitStatus: number
  customer: string
  headerContract: string
  rows: {
    rowType: number
    text: string
    article: string
    amount: number
    reduction: number
    vat: number
  }[]
}

/**
 * Mirrors the production import flow: rowtype-3 rows are contract headers on
 * the printed invoice; every following row belongs to that contract. The
 * contract number is the text up to the first comma (or space).
 */
export const parseContractHeader = (text: string): string => {
  return text.includes(',') ? text.split(',')[0] : text.split(' ')[0]
}

/**
 * Intäktkonto per hyresartikel (repsk p1, keyrektk INTAKT, article level) for
 * the invoice year. Hyresobjektsspecifika regler beaktas inte här.
 */
const getXpandArticleAccounts = async (
  articles: string[],
  month: string
): Promise<Map<string, string>> => {
  if (articles.length === 0) {
    return new Map()
  }

  const year = month.slice(0, 4)
  const rows = (await db('cmart')
    .innerJoin('repsk', 'repsk.keycode', 'cmart.keycmart')
    .select('cmart.code as code', 'repsk.p1 as account')
    .whereIn('cmart.code', articles)
    .andWhere('repsk.year', year)
    .whereLike('repsk.keyrektk', 'INTAKT%')
    .then(trimStrings)) as unknown as { code: string; account: unknown }[]

  const accounts = new Map<string, string>()
  rows.forEach((row) => {
    const code = row.code.trim()
    const account = (row.account ?? '').toString().trimEnd()
    if (account && !accounts.has(code)) {
      accounts.set(code, account)
    }
  })

  return accounts
}

const groupXpandRowsByInvoice = (
  dbRows: XpandInvoiceRowDbRow[]
): XpandInvoice[] => {
  const invoices: Record<string, XpandInvoice> = {}

  dbRows.forEach((row) => {
    const invoiceNumber = row.invoiceNumber.trim()
    const invoice = (invoices[invoiceNumber] ??= {
      invoiceNumber,
      invoiceType: row.invoiceType,
      debitStatus: row.debitStatus,
      customer: row.customerCode.trim(),
      headerContract: (row.headerContract ?? '').trim(),
      rows: [],
    })

    invoice.rows.push({
      rowType: row.rowType,
      text: (row.text ?? '').trim(),
      article: (row.articleCode ?? '').trim(),
      amount: row.amount,
      reduction: row.reduction,
      vat: row.vat,
    })
  })

  return Object.values(invoices)
}

export const getXpandInvoiceRows = async (
  month: string,
  company: string
): Promise<ComparisonRow[]> => {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10))
  const from = new Date(Date.UTC(y, m - 1, 1))
  const to = new Date(Date.UTC(y, m, 1))

  const dbRows = (await db('krfkh')
    .join('krfkr', 'krfkr.keykrfkh', 'krfkh.keykrfkh')
    .join('cmcmp', 'krfkh.keycmcmp', 'cmcmp.keycmcmp')
    .join('cmctc', 'krfkh.keycmctc', 'cmctc.keycmctc')
    .leftJoin('cmart', 'cmart.keycmart', 'krfkr.keycmart')
    .select(
      'krfkh.invoice as invoiceNumber',
      'krfkh.type as invoiceType',
      'krfkh.debstatus as debitStatus',
      'krfkh.reference as headerContract',
      'cmctc.cmctckod as customerCode',
      'krfkr.rowtype as rowType',
      'krfkr.text as text',
      'cmart.code as articleCode',
      'krfkr.amount as amount',
      'krfkr.reduction as reduction',
      'krfkr.vat as vat'
    )
    .where('cmcmp.code', company)
    .andWhere('krfkh.fromdate', '>=', from)
    .andWhere('krfkh.fromdate', '<', to)
    .whereIn('krfkh.type', [1, 2])
    .whereNotNull('krfkh.invoice')
    .orderBy('krfkh.invoice', 'asc')
    .orderBy('krfkr.printsort', 'asc')
    .then(trimStrings)) as unknown as XpandInvoiceRowDbRow[]

  logger.info(
    { invoiceRows: dbRows.length },
    'invoice-compare: fetched Xpand invoice rows'
  )

  // Makulerade fakturor (debitStatus 6) och interna fakturor (IH*) tas inte med
  const invoices = groupXpandRowsByInvoice(dbRows).filter(
    (invoice) =>
      invoice.invoiceNumber !== '' &&
      !invoice.invoiceNumber.toUpperCase().startsWith('IH') &&
      invoice.debitStatus !== 6
  )

  // Intäktkonto per artikel för fakturans år (repsk p1, keyrektk INTAKT)
  const articleKeys = [
    ...new Set(invoices.flatMap((invoice) => invoice.rows.map((row) => row.article)).filter((a) => a !== '')),
  ]
  const articleAccounts = await getXpandArticleAccounts(articleKeys, month)

  const rows: ComparisonRow[] = []

  invoices.forEach((invoice) => {
    let currentContract = invoice.headerContract

    invoice.rows.forEach((row) => {
      if (row.rowType === 3) {
        if (/^\d/.test(row.text)) {
          currentContract = parseContractHeader(row.text)
        }
        return
      }

      if (!row.article) {
        // Subtotal-, moms- och textrader har ingen hyresartikel
        return
      }

      const sign = invoice.invoiceType === 2 ? -1 : 1
      rows.push({
        side: 'xpand',
        invoiceNumber: invoice.invoiceNumber,
        state: invoice.invoiceType === 2 ? 'kredit' : 'faktura',
        customer: invoice.customer,
        contract: currentContract,
        rentalObject: currentContract.split('/')[0] ?? '',
        property: '',
        article: row.article,
        account: articleAccounts.get(row.article) ?? '',
        text: row.text,
        netto: round2(sign * (row.amount + row.reduction)),
        vat: round2(sign * row.vat),
      })
    })
  })

  return rows
}

// ---------------------------------------------------------------------------
// Tenfast
// ---------------------------------------------------------------------------

const TenfastCompareLeaseSchema = z.object({
  _id: z.string(),
  externalId: z.string(),
  hyresobjekt: z
    .array(
      z.object({
        _id: z.string(),
        externalId: z.string(),
      })
    )
    .default([]),
  hyresgaster: z
    .array(
      z.object({
        externalId: z.string(),
      })
    )
    .default([]),
})

const TenfastCompareInvoiceSchema = z
  .object({
    _id: z.string(),
    ocrNumber: z.string().optional().default(''),
    state: z.string(),
    interval: z.object({
      from: z.string(),
      to: z.string(),
    }),
    avtal: z.array(TenfastCompareLeaseSchema).default([]),
    hyror: z.array(TenfastInvoiceRowSchema).default([]),
  })
  .passthrough()

// IJämförelsen tas krediterade och krediterade originals med, över hoppas
const SKIPPED_STATES = new Set(['makulerad'])

const fetchTenfastPaged = async (params: {
  hyresvard: string
  from: string
  to: string
}): Promise<z.infer<typeof TenfastCompareInvoiceSchema>[]> => {
  const records = []
  let next: string | null = ''
  let totalCount: number | undefined = undefined

  while (next !== null && (totalCount === undefined || records.length < totalCount)) {
    const result = await makeTenfastRequest('/v1/hyresvard/hyror', {
      params: {
        hyresvard: params.hyresvard,
        from: params.from,
        to: params.to,
        ...(next ? { paginate: next } : {}),
      },
    })

    if (result.status !== 200) {
      throw new Error(
        `Tenfast returned status ${result.status}: ${JSON.stringify(result.data).slice(0, 500)}`
      )
    }

    const page = z
      .object({
        records: z.array(z.unknown()),
        next: z.string().nullable().optional(),
        totalCount: z.number().optional(),
      })
      .safeParse(result.data)

    if (!page.success) {
      throw new Error('Could not parse Tenfast invoice list response')
    }

    records.push(...page.data.records)
    next = page.data.next ?? null
    totalCount = page.data.totalCount
    logger.info(
      { fetched: records.length, total: totalCount },
      'invoice-compare: fetched Tenfast invoices'
    )

    if (!page.data.records.length && next !== null) {
      break
    }
  }

  return records
    .map((record) => TenfastCompareInvoiceSchema.safeParse(record))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data)
}

type TenfastArticleInfo = {
  code: string
  account: string
}

type TenfastAccountConfiguration = {
  categoryCode?: string
  debitType?: string
  accountNr?: string | number
}

/**
 * Article code (Xpand code) and income account (konto för Intäkter/HYRA,
 * same configuration as the accounting export) per Tenfast article id.
 */
const getArticleInfos = async (
  articleIds: string[]
): Promise<Map<string, TenfastArticleInfo>> => {
  const infos = new Map<string, TenfastArticleInfo>()

  for (const articleId of articleIds) {
    const fallback = { code: articleId, account: '' }
    const result = await getInvoiceArticle(articleId)
    if (!result.ok) {
      infos.set(articleId, fallback)
      continue
    }

    const configurations =
      (result.data.accountConfigurations as
        | TenfastAccountConfiguration[]
        | undefined) ?? []
    const incomeConfiguration = configurations.find(
      (configuration) =>
        configuration.categoryCode === 'Intäkter' &&
        configuration.debitType === 'HYRA'
    )

    infos.set(articleId, {
      code: result.data.code ?? articleId,
      account:
        incomeConfiguration?.accountNr !== undefined
          ? String(incomeConfiguration.accountNr)
          : '',
    })
  }

  return infos
}

export const getTenfastInvoiceRows = async (
  month: string,
  hyresvard: string
): Promise<ComparisonRow[]> => {
  const { fromString, lastDay } = monthBounds(month)
  const invoices = await fetchTenfastPaged({
    hyresvard,
    from: fromString,
    to: lastDay,
  })

  const visible = invoices.filter((invoice) => {
    if (SKIPPED_STATES.has(invoice.state)) return false
    if (invoice.state === 'draft') return false
    const fromDay = invoice.interval.from.slice(0, 10)
    return fromString <= fromDay && fromDay <= lastDay
  })

  logger.info(
    {
      fetched: invoices.length,
      included: visible.length,
    },
    'invoice-compare: filtered Tenfast invoices'
  )

  const articleIds = [
    ...new Set(
      visible.flatMap((invoice) =>
        invoice.hyror
          .map((row) => row.article ?? '')
          .filter((article) => article !== '')
      )
    ),
  ]
  const articleInfos = await getArticleInfos(articleIds)

  const rows: ComparisonRow[] = []

  visible.forEach((invoice) => {
    const byRentalObjectId = new Map<
      string,
      { lease: typeof invoice.avtal[number]; rentalObject: string }
    >()
    invoice.avtal.forEach((lease) => {
      lease.hyresobjekt.forEach((rentalObject) => {
        byRentalObjectId.set(rentalObject._id, {
          lease,
          rentalObject: rentalObject.externalId,
        })
      })
    })

    const mainLease = invoice.avtal[0]
    const mainRentalObject = mainLease?.hyresobjekt[0]?.externalId ?? ''

    invoice.hyror.forEach((row) => {
      const match = row.hyresobjekt
        ? byRentalObjectId.get(row.hyresobjekt)
        : undefined
      const lease = match?.lease ?? mainLease
      const rentalObject = match?.rentalObject ?? mainRentalObject
      const amount = row.amount ?? 0
      const articleInfo = row.article ? articleInfos.get(row.article) : undefined
      const articleCode = articleInfo?.code ?? row.article ?? ''

      rows.push({
        side: 'tenfast',
        invoiceNumber: invoice.ocrNumber || invoice._id,
        state: invoice.state,
        customer: lease?.hyresgaster[0]?.externalId ?? '',
        contract: lease?.externalId ?? '',
        rentalObject,
        property: '',
        article: articleCode,
        account: articleInfo?.account ?? '',
        text: (row.label ?? '').trim(),
        netto: round2(amount),
        vat: round2(amount * (row.vat ?? 0)),
      })
    })
  })

  return rows
}

// ---------------------------------------------------------------------------
// Property lookup
// ---------------------------------------------------------------------------

/**
 * Resolves the Xpand property code (fastighetskod) for every rental object
 * (= contract base, the part before "/"), used to filter both sides.
 */
export const getPropertyMap = async (
  rentalObjectCodes: string[],
  month: string
): Promise<Map<string, string>> => {
  const unique = [...new Set(rentalObjectCodes.map((c) => c.split('/')[0]))].filter(
    (code) => code !== ''
  )
  const year = month.slice(0, 4)
  const rules = await getRentalSpecificRules(unique, year)

  const map = new Map<string, string>()
  unique.forEach((code) => {
    const rule = rules[code]
    if (rule?.property) {
      map.set(code, rule.property)
    }
  })
  return map
}

// ---------------------------------------------------------------------------
// Comparison (pure)
// ---------------------------------------------------------------------------

export const groupKey = (row: ComparisonRow): string => {
  return `${row.contract || '-'}|${row.article || '-'}`
}

export const invoiceKey = (row: ComparisonRow): string => {
  return `${row.side}|${row.invoiceNumber}`
}

export const aggregateRows = (
  rows: ComparisonRow[],
  keyOf: (row: ComparisonRow) => string
): Aggregates => {
  const aggregates: Aggregates = {}

  rows.forEach((row) => {
    const key = keyOf(row)
    const aggregate = (aggregates[key] ??= {
      netto: 0,
      vat: 0,
      count: 0,
    })
    aggregate.netto = round2(aggregate.netto + row.netto)
    aggregate.vat = round2(aggregate.vat + row.vat)
    aggregate.count += 1
  })

  return aggregates
}

const TOLERANCE = 0.005

/**
 * Keys where the two sides differ: present on only one side, or with a netto
 * or vat difference beyond the tolerance.
 */
export const findDiffKeys = (
  left: Aggregates,
  right: Aggregates
): string[] => {
  const diffs: string[] = []

  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])]
  keys.forEach((key) => {
    const a = left[key]
    const b = right[key]
    if (!a || !b) {
      diffs.push(key)
      return
    }
    if (
      Math.abs(a.netto - b.netto) >= TOLERANCE ||
      Math.abs(a.vat - b.vat) >= TOLERANCE
    ) {
      diffs.push(key)
    }
  })

  return diffs.sort()
}

export const toDiffRows = (
  left: Aggregates,
  right: Aggregates,
  diffKeys: string[]
): DiffRow[] => {
  return diffKeys.map((key) => {
    const a = left[key]
    const b = right[key]
    return {
      group: key,
      status: !b ? 'bara i xpand' : !a ? 'bara i tenfast' : 'olika belopp',
      xpandNetto: a ? a.netto : '',
      tenfastNetto: b ? b.netto : '',
      diffNetto: round2((a?.netto ?? 0) - (b?.netto ?? 0)),
      xpandVat: a ? a.vat : '',
      tenfastVat: b ? b.vat : '',
      xpandCount: a?.count ?? 0,
      tenfastCount: b?.count ?? 0,
    }
  })
}

/**
 * For every diffing group: the invoices on each side that contribute to the
 * group's amounts, so a difference can be traced to a specific invoice.
 */
export const invoiceContributions = (
  rows: ComparisonRow[],
  diffKeys: string[],
  keyOf: (row: ComparisonRow) => string
): InvoiceContribution[] => {
  const keys = new Set(diffKeys)
  const byKey = new Map<string, Map<string, InvoiceContribution>>()

  rows.forEach((row) => {
    const key = keyOf(row)
    if (!keys.has(key)) return

    const contributions =
      byKey.get(key) ?? new Map<string, InvoiceContribution>()
    const invoiceNumber = row.invoiceNumber
    let contribution = contributions.get(invoiceNumber)
    if (!contribution) {
      contribution = {
        group: key,
        side: row.side,
        invoiceNumber,
        state: row.state,
        invoiceNetto: 0,
        invoiceVat: 0,
        rowCount: 0,
      }
      contributions.set(invoiceNumber, contribution)
    }
    contribution.invoiceNetto = round2(contribution.invoiceNetto + row.netto)
    contribution.invoiceVat = round2(contribution.invoiceVat + row.vat)
    contribution.rowCount += 1
    byKey.set(key, contributions)
  })

  const out: InvoiceContribution[] = []
  ;[...byKey.keys()]
    .sort()
    .forEach((key) => {
      const contributions = [...byKey.get(key)!.values()]
      const byAbsAmount = (a: InvoiceContribution, b: InvoiceContribution) =>
        Math.abs(b.invoiceNetto) - Math.abs(a.invoiceNetto)
      const xpand = contributions
        .filter((contribution) => contribution.side === 'xpand')
        .sort(byAbsAmount)
      const tenfast = contributions
        .filter((contribution) => contribution.side === 'tenfast')
        .sort(byAbsAmount)
      out.push(...xpand, ...tenfast)
    })
  return out
}

// ---------------------------------------------------------------------------
// Filtering and output
// ---------------------------------------------------------------------------

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item !== '')

export const applyFilters = (
  rows: ComparisonRow[],
  filters: { properties?: string[]; articles?: string[]; accounts?: string[] }
): { rows: ComparisonRow[]; droppedUnknownProperty: number } => {
  const properties = filters.properties
    ? new Set(splitList(filters.properties.join(',')))
    : null
  const articles = filters.articles
    ? new Set(splitList(filters.articles.join(',')))
    : null
  const accounts = filters.accounts
    ? new Set(splitList(filters.accounts.join(',')))
    : null

  let droppedUnknownProperty = 0

  const filtered = rows.filter((row) => {
    if (articles && !articles.has(row.article.trim().toUpperCase())) {
      return false
    }
    if (accounts && !accounts.has(row.account.trim().toUpperCase())) {
      return false
    }
    if (properties) {
      const property = row.property.trim().toUpperCase()
      // Rader utan fastighet (t.ex. avgifter utan hyresobjekt) rapporteras,
      // men kan inte matcha ett fastighetsfilter
      if (property === '') {
        droppedUnknownProperty++
        return false
      }
      if (!properties.has(property)) {
        return false
      }
    }
    return true
  })

  return { rows: filtered, droppedUnknownProperty }
}

const csvEscape = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value)
  if (text.includes(';') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export const toCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return ''
  const columns = Object.keys(rows[0])
  const lines = [columns.join(';')]
  rows.forEach((row) => {
    lines.push(columns.map((column) => csvEscape(row[column])).join(';'))
  })
  return lines.join('\n')
}

const comparisonRowToRecord = (row: ComparisonRow) => ({
  side: row.side,
  faktura: row.invoiceNumber,
  state: row.state,
  kundnr: row.customer,
  kontrakt: row.contract,
  hyresobjekt: row.rentalObject,
  fastighet: row.property,
  artikel: row.article,
  konto: row.account,
  radtext: row.text,
  netto: row.netto.toFixed(2),
  vat: row.vat.toFixed(2),
})

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export type CompareOptions = {
  month: string
  company?: string
  properties?: string[]
  articles?: string[]
  accounts?: string[]
  outputDir?: string
}

export type CompareResult = {
  xpandRows: number
  tenfastRows: number
  diffRows: DiffRow[]
  contributions: InvoiceContribution[]
  files: string[]
}

export const compareInvoices = async (
  options: CompareOptions
): Promise<CompareResult> => {
  const company = options.company ?? '001'
  const outputDir = options.outputDir ?? './generated/invoice-compare'
  const month = options.month

  const mimerCompany = config.companies.find(
    (candidate) => candidate.xpandId === company
  )
  if (!mimerCompany) {
    throw new Error(`Could not find company ${company} in config.companies`)
  }

  logger.info({ month, company, options }, 'invoice-compare: starting')

  logger.info('invoice-compare: fetching Xpand invoice rows...')
  const xpandRows = await getXpandInvoiceRows(month, company)
  logger.info(
    { rows: xpandRows.length },
    'invoice-compare: Xpand rows fetched'
  )

  logger.info('invoice-compare: fetching Tenfast invoice rows...')
  const tenfastRows = await getTenfastInvoiceRows(month, mimerCompany.tenfastId)
  logger.info(
    { rows: tenfastRows.length },
    'invoice-compare: Tenfast rows fetched'
  )

  const allRentalObjects = [
    ...xpandRows.map((row) => row.rentalObject),
    ...tenfastRows.map((row) => row.rentalObject),
  ]
  logger.info(
    { rentalObjects: new Set(allRentalObjects).size },
    'invoice-compare: resolving fastighetskod per hyresobjekt...'
  )
  const propertyMap = await getPropertyMap(allRentalObjects, month)

  ;[...xpandRows, ...tenfastRows].forEach((row) => {
    row.property = propertyMap.get(row.rentalObject.split('/')[0]) ?? ''
  })

  const filteredXpand = applyFilters(xpandRows, {
    properties: options.properties,
    articles: options.articles,
    accounts: options.accounts,
  })
  const filteredTenfast = applyFilters(tenfastRows, {
    properties: options.properties,
    articles: options.articles,
    accounts: options.accounts,
  })

  if (
    (options.properties?.length ?? 0) > 0 &&
    options.properties?.join('').trim() !== ''
  ) {
    logger.info(
      {
        xpandUnknownPropertyRows: filteredXpand.droppedUnknownProperty,
        tenfastUnknownPropertyRows: filteredTenfast.droppedUnknownProperty,
      },
      'invoice-compare: rader utan fastighet (kan inte matcha fastighetsfiltret)'
    )
  }

  console.log(
    `Xpand (${company}): ${filteredXpand.rows.length} rader, Tenfast: ${filteredTenfast.rows.length} rader (efter filter)`
  )

  const xpandAggregates = aggregateRows(filteredXpand.rows, groupKey)
  const tenfastAggregates = aggregateRows(filteredTenfast.rows, groupKey)
  const diffKeys = findDiffKeys(xpandAggregates, tenfastAggregates)
  const diffRows = toDiffRows(xpandAggregates, tenfastAggregates, diffKeys)
  const contributions = invoiceContributions(
    [...filteredXpand.rows, ...filteredTenfast.rows],
    diffKeys,
    groupKey
  )

  const files: string[] = []

  if (options.outputDir !== '') {
    const fs = await import('fs')
    fs.mkdirSync(outputDir, { recursive: true })

    const write = (name: string, content: string) => {
      if (!content) return
      const path = `${outputDir}/${name}`
      fs.writeFileSync(path, content, 'utf-8')
      files.push(path)
      console.log(`  ${path}`)
    }

    write(
      'xpand_rows.csv',
      toCsv(filteredXpand.rows.map(comparisonRowToRecord))
    )
    write(
      'tenfast_rows.csv',
      toCsv(filteredTenfast.rows.map(comparisonRowToRecord))
    )
    write(
      'diff_per_kontrakt_artikel.csv',
      toCsv(
        diffRows.map((row) => {
          const [kontrakt, artikel] = row.group.split('|')
          const invoiceNumbers = (side: ComparisonSide) =>
            contributions
              .filter(
                (contribution) =>
                  contribution.group === row.group && contribution.side === side
              )
              .map((contribution) => contribution.invoiceNumber)
              .join(',')
          return {
            kontrakt,
            artikel,
            status: row.status,
            xpand_netto: row.xpandNetto,
            tenfast_netto: row.tenfastNetto,
            diff_netto: row.diffNetto,
            xpand_vat: row.xpandVat,
            tenfast_vat: row.tenfastVat,
            xpand_fakturor: invoiceNumbers('xpand'),
            tenfast_fakturor: invoiceNumbers('tenfast'),
            xpand_rader: row.xpandCount,
            tenfast_rader: row.tenfastCount,
          }
        })
      )
    )
    write(
      'invoice_contributions.csv',
      toCsv(
        contributions.map((row) => ({
          kontrakt_artikel: row.group,
          side: row.side,
          faktura: row.invoiceNumber,
          state: row.state,
          netto: row.invoiceNetto.toFixed(2),
          vat: row.invoiceVat.toFixed(2),
          rader: row.rowCount,
        }))
      )
    )
  }

  const totalDiff = round2(
    diffRows.reduce((sum, row) => sum + row.diffNetto, 0)
  )
  console.log(
    `${diffRows.length} diffande kontrakt+artikel-grupper, total netto-diff (xpand - tenfast): ${totalDiff.toFixed(2)}`
  )

  const top = [...diffRows]
    .sort((a, b) => Math.abs(b.diffNetto) - Math.abs(a.diffNetto))
    .slice(0, 25)
  if (top.length) {
    console.log('\nStörsta diffar per kontrakt+artikel:')
    top.forEach((row) => {
      const invoiceNumbers = (side: ComparisonSide) =>
        contributions
          .filter(
            (contribution) =>
              contribution.group === row.group && contribution.side === side
          )
          .map((contribution) => contribution.invoiceNumber)
          .join(', ')
      console.log(
        `  ${row.group}\t${row.status}\txpand ${row.xpandNetto} / tenfast ${row.tenfastNetto} (diff ${row.diffNetto})`
      )
      if (row.status !== 'olika belopp') {
        const side = row.status === 'bara i xpand' ? 'xpand' : 'tenfast'
        console.log(`    fakturor (${side}): ${invoiceNumbers(side as ComparisonSide)}`)
      }
    })
  }

  return {
    xpandRows: filteredXpand.rows.length,
    tenfastRows: filteredTenfast.rows.length,
    diffRows,
    contributions,
    files,
  }
}
