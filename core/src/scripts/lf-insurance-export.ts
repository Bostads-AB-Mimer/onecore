import { logger } from '@onecore/utilities'
import config from '../common/config'
import { sendEmail } from '../adapters/communication-adapter'
import { getLfInsuranceExport } from '../processes/reports/service'
import { convertLfInsuranceToXlsx } from '../processes/reports/converters/excelConverter'

export const handleLfInsuranceExport = async () => {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]

  const notification: string[] = [
    `Körning startad: ${now.toLocaleString('sv').replace('T', ' ')}\n`,
  ]

  try {
    const rows = await getLfInsuranceExport()
    const xlsxBuffer = await convertLfInsuranceToXlsx(rows)
    const fileName = `Hemforsakring_LF_${dateStr}.xlsx`

    notification.push(
      `Antal rader: ${rows.length}\n`,
      `Körning avslutad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n---\n`
    )

    try {
      const result = await sendEmail({
        to: config.emailAddresses.lf,
        subject: `Hemförsäkringsexport till LF ${dateStr}`,
        body: notification.join('\n'),
        attachments: [{ data: xlsxBuffer, name: fileName }],
      })

      if (!result.ok) {
        throw result.err
      }
    } catch (error: any) {
      logger.error(error, 'Error sending LF insurance export email')
    }
  } catch (err) {
    logger.error(err, 'Error generating LF insurance export')
    throw err
  }
}

if (require.main === module) {
  handleLfInsuranceExport()
}
