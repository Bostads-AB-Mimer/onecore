import SftpClient from 'ssh2-sftp-client'
import path from 'path'
import { logger } from '@onecore/utilities'

export type SftpConfig = {
  host: string
  port: number
  username: string
  password: string
  directory: string
}

export const uploadFile = async (
  buffer: Buffer,
  fileName: string,
  sftpConfig: SftpConfig
): Promise<void> => {
  const remotePath = path.posix.join(sftpConfig.directory, fileName)
  const sftp = new SftpClient()

  let connected = false

  try {
    await sftp.connect({
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      password: sftpConfig.password,
    })
    connected = true

    await sftp.put(buffer, remotePath)
    logger.info({ remotePath }, 'File uploaded via SFTP')
  } finally {
    if (connected) {
      try {
        await sftp.end()
      } catch (endErr) {
        logger.warn({ err: endErr }, 'Failed to close SFTP connection')
      }
    }
  }
}
