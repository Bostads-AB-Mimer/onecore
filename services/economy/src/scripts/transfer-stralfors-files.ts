import path from 'node:path'
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
  const remotePath = path.posix.join(
    config.stralforsExport.sftp.directory ?? '',
    path.posix.basename(file.filename)
  )
  await client.put(content, remotePath, {
    writeStreamOptions: { flags: 'w', mode: 0o644 },
  })
  logger.info(
    { filename: file.filename, size: content.byteLength },
    'file uploaded to Strålfors SFTP'
  )
}

const environment = `${process.env.APPLICATION_NAME ?? 'economy'} (${config.stralforsExport.sftp.directory})`

async function notify(subject: string, body: string): Promise<void> {
  const recipient = config.stralforsExport.notificationEmail
  if (!recipient) {
    logger.warn(
      'config.stralforsExport.notificationEmail is not set — skipping notification'
    )
    return
  }
  try {
    await sendEmail(recipient, subject, body)
  } catch (emailErr) {
    logger.error({ emailErr }, 'failed to send notification')
  }
}

async function notifySuccess(
  transferred: number,
  failed: number,
  startedAt: Date
): Promise<void> {
  const duration = Math.round((Date.now() - startedAt.getTime()) / 1000)
  await notify(
    `Strålfors-överföring klar [${environment}]`,
    [
      `Miljö: ${environment}`,
      `Starttid: ${startedAt.toISOString()}`,
      `Varaktighet: ${duration}s`,
      `Överförda filer: ${transferred}`,
      failed > 0 ? `Misslyckade filer: ${failed}` : '',
      `SFTP-katalog: ${config.stralforsExport.sftp.directory}`,
    ]
      .filter((line) => line !== '')
      .join('\n')
  )
}

async function notifyFailure(err: unknown, context?: string): Promise<void> {
  await notify(
    `Fel i körning: transfer-stralfors-files [${environment}]`,
    [
      'Överföring av Strålfors-filer misslyckades.',
      context ? `Kontext: ${context}` : undefined,
      '',
      `Fel: ${err instanceof Error ? err.message : String(err)}`,
      '',
      'Filer som inte skickades kommer att försökas igen vid nästa körning.',
    ]
      .filter((line) => line !== undefined)
      .join('\n')
  )
}

export async function transferStralforsFiles(): Promise<void> {
  const startedAt = new Date()
  logger.info('transfer-stralfors-files: starting')

  const listResult = await listNewOutboundExports()
  if (!listResult.ok) {
    const err = new Error('Failed to fetch outbound exports from Tenfast')
    await notifyFailure(err)
    throw err
  }

  const files = listResult.data
  logger.info({ count: files.length }, 'new outbound export files to transfer')

  if (files.length === 0) {
    logger.info('transfer-stralfors-files: nothing to do')
    await notifySuccess(0, 0, startedAt)
    return
  }

  let transferred = 0
  let failed = 0

  const sftpClient = new SftpClient()
  try {
    await sftpClient.connect({
      host: config.stralforsExport.sftp.host,
      username: config.stralforsExport.sftp.username,
      password: config.stralforsExport.sftp.password,
      port: config.stralforsExport.sftp.port ?? 22,
      hostVerifier: (fingerprint: string) => {
        const expected = config.stralforsExport.sftp.hostFingerprint
        if (!expected) {
          logger.warn(
            'STRALFORS_EXPORT__SFTP__HOST_FINGERPRINT is not set — skipping host verification'
          )
          return true
        }
        return fingerprint === expected
      },
      algorithms: {
        serverHostKey: [
          'rsa-sha2-512',
          'rsa-sha2-256',
          'ssh-rsa',
          'ecdsa-sha2-nistp256',
          'ssh-ed25519',
        ],
      },
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
        transferred++
      } catch (err) {
        // Per-file error isolation: log and notify but continue with remaining
        // files so one bad file does not block the rest of the batch.
        logger.error(
          { err, filename: file.filename },
          'transfer-stralfors-files: failed to transfer file, continuing with remaining files'
        )
        await notifyFailure(err, file.filename)
        failed++
      }
    }
  } catch (err) {
    await notifyFailure(err, 'SFTP-anslutning')
    throw err
  } finally {
    await sftpClient.end()
    logger.info('disconnected from Strålfors SFTP')
  }

  await notifySuccess(transferred, failed, startedAt)
  logger.info({ transferred, failed }, 'transfer-stralfors-files: done')
}
