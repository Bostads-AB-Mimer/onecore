import SftpClient from 'ssh2-sftp-client'
import { logger } from '@onecore/utilities'
import {
  listNewOutboundExports,
  downloadOutboundExport,
  markOutboundExportSent,
  type TenfastOutboundExport,
} from '../common/adapters/tenfast/tenfast-adapter'
import { sendEmail } from '../common/adapters/infobip-adapter'
import config from '../common/config'

async function uploadToStralfors(
  client: SftpClient,
  file: TenfastOutboundExport,
  content: Buffer
): Promise<void> {
  const remotePath = `${config.stralforsExport.sftp.directory}/${file.filename}`
  await client.put(content, remotePath, {
    writeStreamOptions: { flags: 'w', mode: 0o644 },
  })
  logger.info(
    { filename: file.filename, size: content.byteLength },
    'file uploaded to Strålfors SFTP'
  )
}

async function notifyFailure(err: unknown, context?: string): Promise<void> {
  const recipient = config.stralforsExport.notificationEmail
  if (!recipient) {
    logger.warn(
      'config.stralforsExport.notificationEmail is not set — skipping failure notification'
    )
    return
  }

  const subject = 'Fel i körning: transfer-stralfors-files'
  const body = [
    'Överföring av Strålfors-filer misslyckades.',
    context ? `Kontext: ${context}` : '',
    '',
    `Fel: ${err instanceof Error ? err.message : String(err)}`,
    '',
    'Filer som inte skickades kommer att försökas igen vid nästa körning.',
  ]
    .filter((line) => line !== undefined)
    .join('\n')

  try {
    await sendEmail(recipient, subject, body)
  } catch (emailErr) {
    logger.error({ emailErr }, 'failed to send failure notification')
  }
}

export async function transferStralforsFiles(): Promise<void> {
  logger.info('transfer-stralfors-files: starting')

  const listResult = await listNewOutboundExports()
  if (!listResult.ok) {
    throw new Error('Failed to fetch outbound exports from Tenfast')
  }

  const files = listResult.data
  logger.info({ count: files.length }, 'new outbound export files to transfer')

  if (files.length === 0) {
    logger.info('transfer-stralfors-files: nothing to do')
    return
  }

  const sftpClient = new SftpClient()
  try {
    await sftpClient.connect({
      host: config.stralforsExport.sftp.host,
      username: config.stralforsExport.sftp.username,
      password: config.stralforsExport.sftp.password,
      port: config.stralforsExport.sftp.port ?? 22,
    })
    logger.info('connected to Strålfors SFTP')

    for (const file of files) {
      try {
        const downloadResult = await downloadOutboundExport(file._id)
        if (!downloadResult.ok) {
          throw new Error(
            `Failed to download file ${file.filename}: ${downloadResult.err}`
          )
        }

        await uploadToStralfors(sftpClient, file, downloadResult.data.content)

        // Mark as sent AFTER successful upload so a crash before this point
        // causes a re-upload on the next run. Re-uploads are safe since Tenfast
        // only marks the file sent once we call this endpoint.
        const markResult = await markOutboundExportSent(file._id)
        if (!markResult.ok) {
          throw new Error(
            `Uploaded ${file.filename} but failed to mark as sent in Tenfast: ${markResult.err}`
          )
        }

        logger.info(
          { filename: file.filename, sentAt: markResult.data.sentAt },
          'file transferred and marked as sent'
        )
      } catch (err) {
        // Per-file error isolation: log and notify but continue with remaining
        // files so one bad file does not block the rest of the batch.
        logger.error(
          { err, filename: file.filename },
          'transfer-stralfors-files: failed to transfer file, continuing with remaining files'
        )
        await notifyFailure(err, file.filename)
      }
    }
  } finally {
    await sftpClient.end()
    logger.info('disconnected from Strålfors SFTP')
  }

  logger.info('transfer-stralfors-files: done')
}
