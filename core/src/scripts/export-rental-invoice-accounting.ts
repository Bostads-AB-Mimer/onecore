import { logger } from '@onecore/utilities'

import config from '../common/config'
import { importInvoices } from '../adapters/economy-adapter'

const exportRentalInvoiceAccountingForCompany = async (companyId: string) => {
  logger.info({ companyId }, 'Exporting rental invoice accounting for company')

  let batch = 0
  // The route exports invoices in chunks, so keep calling it until there are
  // no more invoices left to export for the company.
  for (;;) {
    const result = await importInvoices(companyId)

    if (!result.ok) {
      logger.error(
        { companyId },
        'Failed to export rental invoice accounting for company'
      )
      return
    }

    const { successfulInvoices, skippedInvoices, errors } = result.data

    logger.info(
      {
        companyId,
        batch,
        successfulInvoices: successfulInvoices.length,
        skippedInvoices: skippedInvoices.length,
        errors: errors.length,
      },
      'Exported batch of rental invoice accounting'
    )

    if (successfulInvoices.length === 0) {
      break
    }

    batch++
  }

  logger.info(
    { companyId },
    'Finished exporting rental invoice accounting for company'
  )
}

const exportRentalInvoiceAccounting = async () => {
  const { companyIds } = config.exportRentalInvoiceAccounting

  if (companyIds.length === 0) {
    logger.warn(
      'No companyIds configured for exportRentalInvoiceAccounting, nothing to do'
    )
    return
  }

  for (const companyId of companyIds) {
    try {
      await exportRentalInvoiceAccountingForCompany(companyId)
    } catch (err) {
      logger.error(
        err,
        'Could not export rental invoice accounting for company ' + companyId
      )
    }
  }
}

exportRentalInvoiceAccounting()
