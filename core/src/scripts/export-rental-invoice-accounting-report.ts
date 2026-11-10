import { economy } from '@onecore/types'

import { ImportInvoicesError } from '../adapters/economy-adapter'

export type CompanyExportReport = {
  companyId: string
  exportedCount: number
  skippedCount: number
  // Invoices left out of the export. The same invoice comes back in every
  // batch until it is fixed, so this is keyed to keep one entry per problem.
  errors: Map<string, economy.RentalInvoiceExportError>
  markFailures: economy.MarkInvoiceAsExportedFailure[]
  // Set when the run for the company stopped before all batches were done.
  failure?: { err: ImportInvoicesError; detail?: string }
}

export const createCompanyExportReport = (
  companyId: string
): CompanyExportReport => ({
  companyId,
  exportedCount: 0,
  skippedCount: 0,
  errors: new Map(),
  markFailures: [],
})

export const addBatchToReport = (
  report: CompanyExportReport,
  batch: economy.ImportInvoicesResponse
): void => {
  report.exportedCount += batch.successfulInvoices.length
  report.skippedCount += batch.skippedInvoices.length
  for (const error of batch.errors) {
    const key = [
      error.invoiceNumber,
      error.code,
      error.rentArticle ?? '',
      error.error,
    ].join('\u0000')
    report.errors.set(key, error)
  }
  report.markFailures.push(...batch.markFailures)
}

export type ExportErrorGroup = {
  code: economy.RentalInvoiceExportErrorCode
  invoiceNumbers: string[]
  // Invoice numbers per rent article, for the codes that concern an article.
  byRentArticle: Map<string, string[]>
  // Errors without a rent article, one per invoice and message.
  otherErrors: economy.RentalInvoiceExportError[]
}

const pushUnique = (list: string[], value: string) => {
  if (!list.includes(value)) list.push(value)
}

/**
 * Groups export errors by code, and within a code by rent article, so that a
 * few broken articles affecting hundreds of invoices read as a few lines.
 */
export const groupExportErrors = (
  errors: Iterable<economy.RentalInvoiceExportError>
): ExportErrorGroup[] => {
  const groups = new Map<
    economy.RentalInvoiceExportErrorCode,
    ExportErrorGroup
  >()

  for (const error of errors) {
    let group = groups.get(error.code)
    if (!group) {
      group = {
        code: error.code,
        invoiceNumbers: [],
        byRentArticle: new Map(),
        otherErrors: [],
      }
      groups.set(error.code, group)
    }

    pushUnique(group.invoiceNumbers, error.invoiceNumber)
    if (error.rentArticle) {
      const invoiceNumbers = group.byRentArticle.get(error.rentArticle) ?? []
      pushUnique(invoiceNumbers, error.invoiceNumber)
      group.byRentArticle.set(error.rentArticle, invoiceNumbers)
    } else {
      group.otherErrors.push(error)
    }
  }

  return [...groups.values()].sort(
    (a, b) => b.invoiceNumbers.length - a.invoiceNumbers.length
  )
}

export const countFailedInvoices = (
  errors: Iterable<economy.RentalInvoiceExportError>
): number => new Set([...errors].map((error) => error.invoiceNumber)).size

/**
 * Structured summary of the export errors for the log: invoice count per code
 * and the rent articles involved, without listing every invoice.
 */
export const summarizeExportErrorsForLog = (
  errors: Iterable<economy.RentalInvoiceExportError>
) =>
  Object.fromEntries(
    groupExportErrors(errors).map((group) => [
      group.code,
      {
        invoices: group.invoiceNumbers.length,
        rentArticles: Object.fromEntries(
          [...group.byRentArticle].map(([article, invoiceNumbers]) => [
            article,
            invoiceNumbers.length,
          ])
        ),
      },
    ])
  )

const hasProblems = (report: CompanyExportReport) =>
  report.failure !== undefined ||
  report.errors.size > 0 ||
  report.markFailures.length > 0

const formatTimestamp = (date: Date) =>
  date.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })

const describeFailure = (
  failure: NonNullable<CompanyExportReport['failure']>
): string[] => {
  switch (failure.err) {
    case 'partial-upload':
      return [
        'Körningen avbröts: bara en del av bokföringsfilerna laddades upp till Xledger.',
        `Uppladdade filer: ${failure.detail || 'okänt'}`,
        'Avierna i batchen markerades inte som exporterade och hämtas igen vid nästa körning. Hantera de uppladdade filerna i Xledger innan dess, annars bokförs de två gånger.',
      ]
    case 'export-failed':
      return [
        `Körningen avbröts: exporten misslyckades. ${failure.detail ?? ''}`.trim(),
      ]
    case 'unknown':
      return [
        'Körningen avbröts av ett okänt fel. Se loggarna för detaljer.',
        ...(failure.detail ? [failure.detail] : []),
      ]
  }
}

// Swedish: shown to economy staff in the export report.
const errorCodeDescriptions: Record<
  economy.RentalInvoiceExportErrorCode,
  string
> = {
  'missing-rent-article': 'Hyresrad saknar hyresartikel',
  'rent-article-not-found': 'Hyresartikeln finns inte i Tenfast',
  'rent-article-fetch-failed': 'Hyresartikeln kunde inte hämtas från Tenfast',
  'rent-article-missing-accounts': 'Hyresartikeln saknar konton',
  'rent-article-missing-income-account':
    'Hyresartikeln saknar konto för kategorin Intäkter',
  'missing-rental-object': 'Hyresrad saknar hyresobjekt',
  'missing-round-off-account': 'Konto för öresutjämning saknas i Xpand',
  'accounting-failed': 'Konteringen misslyckades',
  'invoice-not-found': 'Avin finns inte i Tenfast',
  'invoice-fetch-failed': 'Avin kunde inte hämtas från Tenfast',
}

// Keeps the email readable when a broken article affects many invoices; the
// full list is in the logs of the economy service.
const MAX_LISTED_INVOICES = 10
const MAX_LISTED_ERRORS = 50

const listInvoiceNumbers = (invoiceNumbers: string[]) => {
  const listed = invoiceNumbers.slice(0, MAX_LISTED_INVOICES).join(', ')
  const rest = invoiceNumbers.length - MAX_LISTED_INVOICES
  return rest > 0 ? `${listed} och ${rest} till` : listed
}

const pluralInvoices = (count: number) =>
  `${count} ${count === 1 ? 'avi' : 'avier'}`

const describeErrorGroup = (group: ExportErrorGroup): string[] => {
  const lines = [
    `${errorCodeDescriptions[group.code]} (${pluralInvoices(group.invoiceNumbers.length)}):`,
  ]

  const articles = [...group.byRentArticle].sort(
    ([, a], [, b]) => b.length - a.length
  )
  for (const [article, invoiceNumbers] of articles) {
    lines.push(
      `- Hyresartikel ${article}: ${pluralInvoices(invoiceNumbers.length)} (${listInvoiceNumbers(invoiceNumbers)})`
    )
  }

  for (const error of group.otherErrors.slice(0, MAX_LISTED_ERRORS)) {
    lines.push(`- ${error.invoiceNumber}: ${error.error}`)
  }
  const rest = group.otherErrors.length - MAX_LISTED_ERRORS
  if (rest > 0) {
    lines.push(`- ... och ${rest} till, se loggarna`)
  }

  return lines
}

const describeMarkFailure = (failure: economy.MarkInvoiceAsExportedFailure) => {
  const reason =
    failure.error === 'missing-external-id'
      ? 'saknar Tenfast-id'
      : `anropet till Tenfast misslyckades${failure.status ? ` (status ${failure.status})` : ''}`
  return `- ${failure.invoiceNumber}: ${reason}`
}

const describeCompany = (report: CompanyExportReport): string[] => {
  const lines = [
    `Företag ${report.companyId}`,
    `Exporterade avier: ${report.exportedCount}`,
    `Överhoppade avier (interna kunder): ${report.skippedCount}`,
  ]

  if (report.failure) {
    lines.push('', ...describeFailure(report.failure))
  }

  if (report.markFailures.length > 0) {
    lines.push(
      '',
      'Avier som laddats upp till Xledger men inte kunde markeras som exporterade i Tenfast. Markera dem manuellt innan nästa körning, annars bokförs de två gånger:',
      ...report.markFailures.map(describeMarkFailure)
    )
  }

  if (report.errors.size > 0) {
    lines.push(
      '',
      `Avier med fel (exporterades inte): ${countFailedInvoices(report.errors.values())}`
    )
    for (const group of groupExportErrors(report.errors.values())) {
      lines.push('', ...describeErrorGroup(group))
    }
  }

  return lines
}

export const buildExportReportEmail = (
  reports: CompanyExportReport[],
  startedAt: Date,
  finishedAt: Date
): { subject: string; body: string[] } => {
  const failed = reports.some(hasProblems)
  const subject = failed
    ? 'Fel i körning: export av hyresavier till Xledger'
    : 'Körning: export av hyresavier till Xledger'

  const totalExported = reports.reduce((sum, r) => sum + r.exportedCount, 0)

  const body = [
    `Körning startad: ${formatTimestamp(startedAt)}`,
    `Körning avslutad: ${formatTimestamp(finishedAt)}`,
    `Totalt exporterade avier: ${totalExported}`,
  ]
  for (const report of reports) {
    body.push('', '---', '', ...describeCompany(report))
  }

  return { subject, body }
}
