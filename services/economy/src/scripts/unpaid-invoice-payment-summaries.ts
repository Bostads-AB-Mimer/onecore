import { logger } from '@onecore/utilities'
import config from '../common/config'
import { sendEmail } from '../common/adapters/infobip-adapter'
import { getUnpaidInvoicePaymentSummaries } from '../services/report-service/service'
import { convertInvoicePaymentSummariesToXlsx } from '../services/report-service/converters/excelConverter'

export const handleInvoicePaymentSummaries = async () => {
  const now = new Date()

  const notification: string[] = [
    `Körning startad: ${now.toLocaleString('sv').replace('T', ' ')}\n`,
  ]
  const resultFiles: { data: any; name: string }[] = []

  try {
    const invoicePaymentSummaries = await getUnpaidInvoicePaymentSummaries()
    const xlsxBuffer = await convertInvoicePaymentSummariesToXlsx(
      invoicePaymentSummaries
    )

    const fileName = `Obetalda_hyresavier_${now.toISOString()}.xlsx`
    resultFiles.push({ data: xlsxBuffer, name: fileName })

    notification.push(
      `Körning avslutad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n---\n`
    )

    if (config.scriptNotificationEmailAddresses) {
      try {
        await sendEmail(
          config.scriptNotificationEmailAddresses,
          'Körning: rapport av obetalda hyresavier',
          notification.join('\n'),
          resultFiles
        )
      } catch (error: any) {
        logger.error(error, 'Error sending notification email')
      }
    }
  } catch (err) {
    logger.error(err)
    throw err
  }
}

if (require.main === module) {
  handleInvoicePaymentSummaries()
}
