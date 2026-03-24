import { logger } from '@onecore/utilities'
import config from '../common/config'
import { sendEmail } from '../adapters/communication-adapter'
import { getUnpaidInvoicePaymentSummaries } from '../processes/reports/service'
import { convertInvoicePaymentSummariesToXlsx } from '../processes/reports/converters/excelConverter'

export const handleUnpaidInvoicePaymentSummaries = async () => {
  const now = new Date()

  const notification: string[] = [
    `Körning startad: ${now.toLocaleString('sv').replace('T', ' ')}\n`,
  ]
  const resultFiles: { data: Buffer; name: string }[] = []

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

    try {
      const result = await sendEmail({
        to: config.emailAddresses.economy,
        subject: 'Körning: rapport av obetalda hyresavier',
        body: notification.join('\n'),
        attachments: resultFiles,
      })

      if (!result.ok) {
        throw result.err
      }
    } catch (error: any) {
      logger.error(error, 'Error sending notification email')
    }
  } catch (err) {
    logger.error(err)
    throw err
  }
}

if (require.main === module) {
  handleUnpaidInvoicePaymentSummaries()
}
