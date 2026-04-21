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

  try {
    await sftp.connect({
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      password: sftpConfig.password,
    })

    await sftp.put(buffer, remotePath)
    logger.info({ remotePath }, 'File uploaded via SFTP')
  } finally {
    await sftp.end()
  }
}
