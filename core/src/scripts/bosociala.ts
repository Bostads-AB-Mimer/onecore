import { logger } from '@onecore/utilities'
import config from '../common/config'
import { sendEmail } from '../adapters/communication-adapter'
import { getBosociala } from '../processes/reports/service'
import { convertBosocialaToXlsx } from '../processes/reports/converters/excelConverter'

export const handleBosociala = async () => {
  const now = new Date()

  const notification: string[] = [
    `Körning startad: ${now.toLocaleString('sv').replace('T', ' ')}\n`,
  ]
  const resultFiles: { data: Buffer; name: string }[] = []

  try {
    const bosociala = await getBosociala()
    const xlsxBuffer = await convertBosocialaToXlsx(bosociala)
    const fileName = `Bosociala_${now.toISOString()}.xlsx`
    resultFiles.push({ data: xlsxBuffer, name: fileName })

    notification.push(
      `Körning avslutad: ${new Date().toLocaleString('sv').replace('T', ' ')}\n---\n`
    )

    if (config.emailAddresses.bosociala) {
      try {
        await sendEmail({
          to: config.emailAddresses.bosociala,
          subject: 'Körning: rapport till bosociala',
          body: notification.join('\n'),
          attachments: resultFiles,
        })
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
  handleBosociala()
}
