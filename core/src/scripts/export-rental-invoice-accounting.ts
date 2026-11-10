import { errorMessage, logger } from '@onecore/utilities'

import config from '../common/config'
import { importInvoices } from '../adapters/economy-adapter'
import { notifyEconomy } from './shared/notify'
import {
  addBatchToReport,
  buildExportReportEmail,
  CompanyExportReport,
  countFailedInvoices,
  createCompanyExportReport,
  summarizeExportErrorsForLog,
} from './export-rental-invoice-accounting-report'

const exportRentalInvoiceAccountingForCompany = async (
  companyId: string
): Promise<CompanyExportReport> => {
  logger.info({ companyId }, 'Exporting rental invoice accounting for company')

  const report = createCompanyExportReport(companyId)

  let batch = 0
  // The route exports invoices in chunks, so keep calling it until there are
  // no more invoices left to export for the company.
  for (;;) {
    const result = await importInvoices(companyId)

    if (!result.ok) {
      // The adapter has already logged the failure.
      report.failure = { err: result.err, detail: result.detail }
      return report
    }

    const { successfulInvoices, skippedInvoices, errors, markFailures } =
      result.data
    addBatchToReport(report, result.data)

    logger.info(
      {
        companyId,
        batch,
        successfulInvoices: successfulInvoices.length,
        skippedInvoices: skippedInvoices.length,
        errors: errors.length,
        errorsByCode: summarizeExportErrorsForLog(errors),
        markFailures: markFailures.length,
      },
      'Exported batch of rental invoice accounting'
    )

    // Invoices that could not be marked as exported would be fetched and
    // posted again by the next batch, so stop until they are handled.
    if (markFailures.length > 0 || successfulInvoices.length === 0) {
      break
    }

    batch++
  }

  // Failed invoices come back in every batch, so this is logged once per
  // company. Each error is also logged by the economy service.
  if (report.errors.size > 0) {
    logger.warn(
      {
        companyId,
        failedInvoices: countFailedInvoices(report.errors.values()),
        errorsByCode: summarizeExportErrorsForLog(report.errors.values()),
      },
      'Rental invoices left out of the accounting export'
    )
  }

  logger.info(
    { companyId },
    'Finished exporting rental invoice accounting for company'
  )
  return report
}

const exportRentalInvoiceAccounting = async () => {
  const { companyIds } = config.exportRentalInvoiceAccounting

  if (companyIds.length === 0) {
    logger.warn(
      'No companyIds configured for exportRentalInvoiceAccounting, nothing to do'
    )
    return
  }

  const startedAt = new Date()
  const reports: CompanyExportReport[] = []

  for (const companyId of companyIds) {
    try {
      reports.push(await exportRentalInvoiceAccountingForCompany(companyId))
    } catch (err: unknown) {
      const detail = errorMessage(err)
      logger.error(
        { companyId, error: detail },
        'Could not export rental invoice accounting for company'
      )
      reports.push({
        ...createCompanyExportReport(companyId),
        failure: { err: 'unknown', detail },
      })
    }
  }

  const { subject, body } = buildExportReportEmail(
    reports,
    startedAt,
    new Date()
  )
  await notifyEconomy(subject, body)
}

exportRentalInvoiceAccounting()
