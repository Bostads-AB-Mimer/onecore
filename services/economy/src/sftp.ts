import config from './common/config'
import SftpClient from 'ssh2-sftp-client'

export const uploadFile = async (filename: string, csvFile: string) => {
  const sftpConfig: SftpClient.ConnectOptions = {
    host: config.xledger.sftp.host,
    username: config.xledger.sftp.username,
    password: config.xledger.sftp.password,
    algorithms: {
      serverHostKey: ['ssh-dss'],
    },
    debug: console.log,
  }
  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConfig)
    await sftp.put(Buffer.from(csvFile), '/AR/test.txt')
  } catch (err) {
    throw new Error('SFTP : ' + JSON.stringify(err))
  } finally {
    await sftp.end()
  }
}

uploadFile('test.csv', 'DETTA ÄR ETT TEST')
