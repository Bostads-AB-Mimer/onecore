import fs from 'fs/promises'
import SftpClient from 'ssh2-sftp-client'
import { markProcurementFilesAsImported } from '@src/services/procurement-invoice-service/adapters/procurement-file-adapter'

jest.mock('ssh2-sftp-client')
jest.mock('fs/promises', () => ({
  __esModule: true,
  default: { rm: jest.fn(), readFile: jest.fn() },
}))

const MockSftpClient = SftpClient as jest.MockedClass<typeof SftpClient>

describe('markProcurementFilesAsImported', () => {
  let connect: jest.Mock
  let rename: jest.Mock
  let end: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    connect = jest.fn().mockResolvedValue(undefined)
    rename = jest.fn().mockResolvedValue(undefined)
    end = jest.fn().mockResolvedValue(true)
    MockSftpClient.mockImplementation(
      () => ({ connect, rename, end }) as unknown as SftpClient
    )
  })

  it('renames all files over a single connection', async () => {
    const result = await markProcurementFilesAsImported([
      'a.xml',
      'b.xml',
      'c.xml',
    ])

    expect(connect).toHaveBeenCalledTimes(1)
    expect(rename).toHaveBeenCalledTimes(3)
    expect(rename.mock.calls[0][1]).toMatch(/a\.xml-imported$/)
    expect(result).toEqual({ marked: ['a.xml', 'b.xml', 'c.xml'], failed: {} })
    expect(fs.rm).toHaveBeenCalledTimes(3)
  })

  it('continues and reports files that could not be renamed', async () => {
    rename.mockImplementation(async (from: string) => {
      if (from.endsWith('b.xml')) throw new Error('No such file')
    })

    const result = await markProcurementFilesAsImported([
      'a.xml',
      'b.xml',
      'c.xml',
    ])

    expect(result.marked).toEqual(['a.xml', 'c.xml'])
    expect(result.failed).toEqual({ 'b.xml': 'No such file' })
  })

  it('reports all files as failed without throwing when the connection fails', async () => {
    connect.mockRejectedValue(new Error('Connection refused'))

    const result = await markProcurementFilesAsImported(['a.xml', 'b.xml'])

    expect(result.marked).toEqual([])
    expect(result.failed).toEqual({
      'a.xml': 'Connection refused',
      'b.xml': 'Connection refused',
    })
  })

  it('does nothing when there are no files', async () => {
    const result = await markProcurementFilesAsImported([])

    expect(connect).not.toHaveBeenCalled()
    expect(result).toEqual({ marked: [], failed: {} })
  })
})
