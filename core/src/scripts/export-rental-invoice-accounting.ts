import { errorMessage, logger } from '@onecore/utilities'

import config from '../common/config'
import { notifyEconomy } from './shared/notify'
import { exportRentalInvoiceAccountingForCompany } from './export-rental-invoice-accounting-company'
import {
  buildExportReportEmail,
  CompanyExportReport,
  createCompanyExportReport,
} from './export-rental-invoice-accounting-report'

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
