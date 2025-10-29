jest.mock('@src/common/config', () => require('./__mocks__/config'))

jest.mock('ssh2-sftp-client', () => {
  class MockSftpClient {
    connect = jest.fn().mockResolvedValue(this)
    end = jest.fn().mockResolvedValue(undefined)
    list = jest.fn().mockResolvedValue([])
    get = jest.fn().mockResolvedValue(Buffer.from(''))
    put = jest.fn().mockResolvedValue('')
    rename = jest.fn().mockResolvedValue('')
  }

  return jest.fn().mockImplementation(() => new MockSftpClient())
})

jest.mock('@src/services/debt-collection-service/service', () => ({
  enrichRentInvoices: jest.fn(),
  enrichOtherInvoices: jest.fn(),
  enrichBalanceCorrections: jest.fn(),
}))

import { logger } from '@onecore/utilities'
import mockConfig from './__mocks__/config'
import {
  enrichRentInvoices,
  enrichOtherInvoices,
  enrichBalanceCorrections,
} from '@src/services/debt-collection-service/service'
import {
  getDebtCollectionFiles,
  readFile,
  markCsvFileAsCompleted,
  getExportFilePath,
  createBufferForSergel,
  importSftpConfig,
  exportSftpConfig,
  processDebtCollectionFiles,
} from '@src/scripts/import-debt-collection'

// Create a spy for path.join since it's used in getExportFilePath
jest.mock('node:path', () => ({
  join: jest.fn().mockImplementation((...paths: string[]) => paths.join('/')),
}))

describe('Import Debt Collection Script', () => {
  let MockSftpClient: jest.MockedClass<any>

  beforeEach(() => {
    jest.clearAllMocks()

    MockSftpClient = require('ssh2-sftp-client')
    ;(enrichRentInvoices as jest.Mock).mockResolvedValue({
      ok: true,
      file: 'mocked-output-file-content',
    })
    ;(enrichOtherInvoices as jest.Mock).mockResolvedValue({
      ok: true,
      file: 'mocked-output-file-content',
    })
    ;(enrichBalanceCorrections as jest.Mock).mockResolvedValue({
      ok: true,
      file: 'mocked-output-file-content',
    })
  })

  describe('SFTP Configuration', () => {
    it('should use correct import SFTP configuration', () => {
      expect(importSftpConfig).toMatchObject({
        host: mockConfig.debtCollection.xledger.sftp.host,
        username: mockConfig.debtCollection.xledger.sftp.username,
        password: mockConfig.debtCollection.xledger.sftp.password,
        port: mockConfig.debtCollection.xledger.sftp.port,
      })
    })

    it('should use correct export SFTP configuration', () => {
      expect(exportSftpConfig).toMatchObject({
        host: mockConfig.debtCollection.sergel.sftp.host,
        username: mockConfig.debtCollection.sergel.sftp.username,
        password: mockConfig.debtCollection.sergel.sftp.password,
        port: mockConfig.debtCollection.sergel.sftp.port,
      })
    })
  })

  describe('File Discovery', () => {
    it('should discover CSV files in all directories', async () => {
      const mockClient = new MockSftpClient()

      mockClient.list
        .mockResolvedValueOnce([
          { name: 'rent-invoice-1.csv' },
          { name: 'rent-invoice-2.csv' },
        ])
        .mockResolvedValueOnce([{ name: 'balance-correction-1.csv' }])
        .mockResolvedValueOnce([{ name: 'other-invoice-1.csv' }])

      const result = await getDebtCollectionFiles(mockClient)

      expect(result).toHaveLength(4)
      expect(result).toEqual([
        {
          type: 'rentInvoice',
          directory: mockConfig.debtCollection.xledger.rentInvoicesDirectory,
          fileName: 'rent-invoice-1.csv',
        },
        {
          type: 'rentInvoice',
          directory: mockConfig.debtCollection.xledger.rentInvoicesDirectory,
          fileName: 'rent-invoice-2.csv',
        },
        {
          type: 'otherInvoice',
          directory: mockConfig.debtCollection.xledger.otherInvoicesDirectory,
          fileName: 'other-invoice-1.csv',
        },
        {
          type: 'balanceCorrection',
          directory:
            mockConfig.debtCollection.xledger.balanceCorrectionsDirectory,
          fileName: 'balance-correction-1.csv',
        },
      ])

      expect(mockClient.list).toHaveBeenCalledTimes(3)
      expect(mockClient.list).toHaveBeenCalledWith(
        mockConfig.debtCollection.xledger.rentInvoicesDirectory,
        expect.any(Function)
      )
      expect(mockClient.list).toHaveBeenCalledWith(
        mockConfig.debtCollection.xledger.balanceCorrectionsDirectory,
        expect.any(Function)
      )
      expect(mockClient.list).toHaveBeenCalledWith(
        mockConfig.debtCollection.xledger.otherInvoicesDirectory,
        expect.any(Function)
      )
    })
  })

  describe('File Processing', () => {
    it('should read file contents correctly', async () => {
      const mockClient = new MockSftpClient()
      const mockFileContents = 'csv,content,here'
      mockClient.get.mockResolvedValue(mockFileContents)

      const filePath = '/test/path/file.csv'
      const result = await readFile(mockClient, filePath)

      expect(result).toBe(mockFileContents)
      expect(mockClient.get).toHaveBeenCalledWith(filePath)
    })

    it('should rename processed files correctly', async () => {
      const mockClient = new MockSftpClient()

      await markCsvFileAsCompleted(mockClient, '/path/to/file.csv')

      expect(mockClient.rename).toHaveBeenCalledWith(
        '/path/to/file.csv',
        '/path/to/file.csv-imported'
      )
    })

    it('should handle case insensitive CSV extension replacement', async () => {
      const mockClient = new MockSftpClient()

      await markCsvFileAsCompleted(mockClient, '/path/to/file.CSV')

      expect(mockClient.rename).toHaveBeenCalledWith(
        '/path/to/file.CSV',
        '/path/to/file.csv-imported'
      )
    })

    it('should generate correct export file path', () => {
      const result = getExportFilePath('invoice.csv')
      const expectedPath = `${mockConfig.debtCollection.sergel.directory}/invoice.txt`

      expect(result).toBe(expectedPath)
    })

    it('should convert line endings for Sergel format', () => {
      const content = 'line1\nline2\nline3'
      const result = createBufferForSergel(content)

      expect(result.toString('latin1')).toBe('line1\r\nline2\r\nline3')
    })
  })

  describe('Integration Tests', () => {
    it('should process complete workflow successfully', async () => {
      const mockImportClient = new MockSftpClient()
      const mockExportClient = new MockSftpClient()

      MockSftpClient.mockImplementationOnce(
        () => mockImportClient
      ).mockImplementationOnce(() => mockExportClient)

      mockImportClient.list
        .mockResolvedValueOnce([{ name: 'rent-invoice.csv' }])
        .mockResolvedValueOnce([{ name: 'balance-correction.csv' }])
        .mockResolvedValueOnce([])

      mockImportClient.get.mockResolvedValue(Buffer.from('csv,content'))

      await processDebtCollectionFiles()

      expect(mockImportClient.connect).toHaveBeenCalledTimes(1)
      expect(mockImportClient.connect).toHaveBeenCalledWith(importSftpConfig)
      expect(mockExportClient.connect).toHaveBeenCalledTimes(1)
      expect(mockExportClient.connect).toHaveBeenCalledWith(exportSftpConfig)

      expect(enrichRentInvoices).toHaveBeenCalledWith('csv,content')
      expect(enrichBalanceCorrections).toHaveBeenCalledWith('csv,content')
      expect(enrichOtherInvoices).not.toHaveBeenCalled()
      expect(mockExportClient.put).toHaveBeenCalledTimes(2)
      expect(mockImportClient.rename).toHaveBeenCalledTimes(2)

      expect(mockImportClient.end).toHaveBeenCalledTimes(1)
      expect(mockExportClient.end).toHaveBeenCalledTimes(1)
    })

    it('should handle processing errors gracefully', async () => {
      const mockImportClient = new MockSftpClient()
      const mockExportClient = new MockSftpClient()

      MockSftpClient.mockImplementationOnce(
        () => mockImportClient
      ).mockImplementationOnce(() => mockExportClient)

      mockImportClient.list
        .mockResolvedValueOnce([
          { name: 'good-invoice.csv' },
          { name: 'bad-invoice.csv' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      mockImportClient.get
        .mockResolvedValueOnce(Buffer.from('good,csv,content'))
        .mockResolvedValueOnce(Buffer.from('bad,csv,content'))

      // Mock enrichment - first succeeds, second fails
      ;(enrichRentInvoices as jest.Mock)
        .mockResolvedValueOnce({ ok: true, file: 'success-content' })
        .mockResolvedValueOnce({
          ok: false,
          error: new Error('Processing failed'),
        })

      await processDebtCollectionFiles()

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('Failed to process file')
      )
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('1 errors:')
      )
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('bad-invoice.csv')
      )

      expect(mockExportClient.put).toHaveBeenCalledTimes(1)
      expect(mockImportClient.rename).toHaveBeenCalledTimes(1)

      expect(mockImportClient.end).toHaveBeenCalledTimes(1)
      expect(mockExportClient.end).toHaveBeenCalledTimes(1)
    })

    it('should handle SFTP connection errors', async () => {
      const mockImportClient = new MockSftpClient()
      const mockExportClient = new MockSftpClient()

      MockSftpClient.mockImplementationOnce(
        () => mockImportClient
      ).mockImplementationOnce(() => mockExportClient)

      const connectionError = new Error('SFTP connection failed')
      mockImportClient.connect.mockRejectedValue(connectionError)

      await expect(processDebtCollectionFiles()).rejects.toThrow(
        'SFTP connection failed'
      )

      expect(logger.error).toHaveBeenCalledWith(connectionError)

      expect(mockImportClient.end).toHaveBeenCalledTimes(1)
      expect(mockExportClient.end).toHaveBeenCalledTimes(1)
    })
  })
})
