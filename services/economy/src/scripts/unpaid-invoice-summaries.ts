import dayjs from 'dayjs'
import { logger } from '@onecore/utilities'
import config from '../common/config'
import { sendEmail } from '../common/adapters/infobip-adapter'
import { getUnpaidInvoiceSummaries } from '../services/report-service/service'
import { convertUnpaidInvoiceSummariesToXlsx } from '../services/report-service/converters/excelConverter'

export const handleUnpaidInvoiceSummaries = async (from: Date, to: Date) => {
  const notification: string[] = [
    `Körning startad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n`,
  ]
  const resultFiles: { data: any; name: string }[] = []

  try {
    const unpaidInvoiceSummaries = await getUnpaidInvoiceSummaries(from, to)
    const xlsxBuffer = await convertUnpaidInvoiceSummariesToXlsx(
      unpaidInvoiceSummaries
    )

    const fileName = `Obetalda_hyresavier_${from.toISOString().split('T')[0]}-${to.toISOString().split('T')[0]}.xlsx`
    resultFiles.push({ data: xlsxBuffer, name: fileName })

    notification.push(
      `Körning avslutad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n---\n`
    )

    if (config.scriptNotificationEmailAddresses) {
      try {
        await sendEmail(
          config.scriptNotificationEmailAddresses,
          'Körning: rapport av obetalda hyresavier med hemförsäkring',
          notification.join('\n'),
          resultFiles
        )
      } catch {
        // Do not fail script even if email fails
      }
    }
  } catch (err) {
    logger.error(err)
    throw err
  }
}

if (require.main === module) {
  const isValidDate = (date: Date) => {
    return !isNaN(date.getTime())
  }

  let from: Date
  let to: Date
  if (process.argv.length < 4) {
    const now = dayjs()
    const then = now.subtract(1, 'month')

    from = then.toDate()
    to = now.toDate()
  } else {
    from = new Date(process.argv[2])
    to = new Date(process.argv[3])
  }

  if (isValidDate(from) && isValidDate(to)) {
    handleUnpaidInvoiceSummaries(from, to)
  } else {
    logger.error('Invalid from/to date')
    process.exitCode = 1
  }
}
