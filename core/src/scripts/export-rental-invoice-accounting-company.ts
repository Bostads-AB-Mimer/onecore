import { logger } from '@onecore/utilities'

import { importInvoices } from '../adapters/economy-adapter'
import {
  createInvoiceRecipients,
  createMissingInvoiceRecipients,
} from './export-rental-invoice-accounting-customers'
import {
  addBatchToReport,
  addCustomersToReport,
  CompanyExportReport,
  countFailedInvoices,
  createCompanyExportReport,
  summarizeExportErrorsForLog,
} from './export-rental-invoice-accounting-report'

type ExportRentalInvoiceAccountingDeps = {
  importInvoices: typeof importInvoices
  createMissingInvoiceRecipients: (
    companyId: string
  ) => ReturnType<typeof createMissingInvoiceRecipients>
  createInvoiceRecipients: (
    codes: string[]
  ) => ReturnType<typeof createInvoiceRecipients>
}

const defaultDeps: ExportRentalInvoiceAccountingDeps = {
  importInvoices,
  createMissingInvoiceRecipients: (companyId) =>
    createMissingInvoiceRecipients(companyId),
  createInvoiceRecipients: (codes) => createInvoiceRecipients(codes),
}

export const exportRentalInvoiceAccountingForCompany = async (
  companyId: string,
  deps: ExportRentalInvoiceAccountingDeps = defaultDeps
): Promise<CompanyExportReport> => {
  logger.info({ companyId }, 'Exporting rental invoice accounting for company')

  const report = createCompanyExportReport(companyId)

  const { attempted: upFrontAttempted, ...upFront } =
    await deps.createMissingInvoiceRecipients(companyId)
  addCustomersToReport(report, upFront)
  const attempted = new Set(upFrontAttempted)

  let batch = 0
  // The route exports invoices in chunks, so keep calling it until there are
  // no more invoices left to export for the company.
  for (;;) {
    const result = await deps.importInvoices(companyId)

    if (!result.ok) {
      // The adapter has already logged the failure.
      report.failure = { err: result.err, detail: result.detail }
      return report
    }

    const {
      successfulInvoices,
      skippedInvoices,
      errors,
      markFailures,
      missingCustomerCodes,
    } = result.data
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
        missingCustomerCodes: missingCustomerCodes.length,
      },
      'Exported batch of rental invoice accounting'
    )

    // Invoices that could not be marked as exported would be fetched and
    // posted again by the next batch, so stop until they are handled.
    if (markFailures.length > 0) {
      break
    }

    const newCodes = missingCustomerCodes.filter((code) => !attempted.has(code))
    let createdCustomers = false
    if (newCodes.length > 0) {
      newCodes.forEach((code) => attempted.add(code))
      const created = await deps.createInvoiceRecipients(newCodes)
      addCustomersToReport(report, created)
      createdCustomers = created.created.length + created.updated.length > 0
    }

    if (successfulInvoices.length === 0 && !createdCustomers) {
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
