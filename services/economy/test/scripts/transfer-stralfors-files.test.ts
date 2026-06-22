jest.mock('@src/common/config', () => require('@test/common/__mocks__/config'))

jest.mock('ssh2-sftp-client', () => jest.fn())

jest.mock('@src/common/adapters/tenfast/tenfast-adapter', () => ({
  listNewOutboundExports: jest.fn(),
  downloadOutboundExport: jest.fn(),
  markOutboundExportSent: jest.fn(),
}))

jest.mock('@src/common/adapters/infobip-adapter', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))

import SftpClient from 'ssh2-sftp-client'
import {
  listNewOutboundExports,
  downloadOutboundExport,
  markOutboundExportSent,
} from '@src/common/adapters/tenfast/tenfast-adapter'
import { sendEmail } from '@src/common/adapters/infobip-adapter'
import { transferStralforsFiles } from '@src/scripts/transfer-stralfors-files'
import type { TenfastOutboundExport } from '@src/common/adapters/tenfast/tenfast-adapter'

const mockListNew = listNewOutboundExports as jest.Mock
const mockDownload = downloadOutboundExport as jest.Mock
const mockMarkSent = markOutboundExportSent as jest.Mock
const mockSendEmail = sendEmail as jest.Mock

const makeExport = (
  overrides?: Partial<TenfastOutboundExport>
): TenfastOutboundExport => ({
  _id: 'export-id-1',
  provider: 'stralfors',
  type: 'stralfors_invoice',
  format: 'xml',
  status: 'NEW',
  size: 1024,
  filename: 'job-abc123.xml',
  invoicesCount: 2,
  sentAt: null,
  failedAt: null,
  createdAt: '2026-06-09T13:41:20.378Z',
  updatedAt: '2026-06-09T13:41:20.378Z',
  ...overrides,
})

let mockSftpInstance: { connect: jest.Mock; end: jest.Mock; put: jest.Mock }

beforeEach(() => {
  jest.clearAllMocks()

  mockSftpInstance = {
    connect: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    put: jest.fn().mockResolvedValue(''),
  }
  ;(SftpClient as jest.Mock).mockImplementation(() => mockSftpInstance)
})

describe('transferStralforsFiles', () => {
  describe('happy path', () => {
    it('does nothing when there are no NEW exports', async () => {
      mockListNew.mockResolvedValueOnce({ ok: true, data: [] })

      await transferStralforsFiles()

      expect(mockSftpInstance.connect).not.toHaveBeenCalled()
      expect(mockDownload).not.toHaveBeenCalled()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('connects to SFTP, uploads the file and marks it as sent', async () => {
      const export1 = makeExport()
      const fileContent = Buffer.from('<INVOICEINFO/>')
      mockListNew.mockResolvedValueOnce({ ok: true, data: [export1] })
      mockDownload.mockResolvedValueOnce({
        ok: true,
        data: { content: fileContent, filename: export1.filename },
      })
      mockMarkSent.mockResolvedValueOnce({
        ok: true,
        data: { ...export1, status: 'SENT', sentAt: '2026-06-09T14:00:00.000Z' },
      })

      await transferStralforsFiles()

      expect(mockSftpInstance.connect).toHaveBeenCalledTimes(1)
      expect(mockDownload).toHaveBeenCalledWith(export1._id)
      expect(mockSftpInstance.put).toHaveBeenCalledWith(
        fileContent,
        `TEST/${export1.filename}`,
        expect.any(Object)
      )
      expect(mockMarkSent).toHaveBeenCalledWith(export1._id)
      expect(mockSftpInstance.end).toHaveBeenCalled()
    })

    it('sends success notification with transferred count after run', async () => {
      const exports = [
        makeExport({ _id: 'id-1' }),
        makeExport({ _id: 'id-2', filename: 'job-def456.xml' }),
      ]
      mockListNew.mockResolvedValueOnce({ ok: true, data: exports })
      mockDownload.mockResolvedValue({
        ok: true,
        data: { content: Buffer.from(''), filename: 'file.xml' },
      })
      mockMarkSent.mockResolvedValue({
        ok: true,
        data: { ...exports[0], status: 'SENT', sentAt: '' },
      })

      await transferStralforsFiles()

      expect(mockSendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Strålfors-överföring klar'),
        expect.stringContaining('Överförda filer: 2')
      )
    })

    it('uploads before marking as sent', async () => {
      const callOrder: string[] = []
      const export1 = makeExport()
      mockListNew.mockResolvedValueOnce({ ok: true, data: [export1] })
      mockDownload.mockResolvedValueOnce({
        ok: true,
        data: { content: Buffer.from(''), filename: export1.filename },
      })
      mockSftpInstance.put.mockImplementation(async () => {
        callOrder.push('put')
      })
      mockMarkSent.mockImplementation(async () => {
        callOrder.push('mark-sent')
        return { ok: true, data: { ...export1, status: 'SENT', sentAt: '' } }
      })

      await transferStralforsFiles()

      expect(callOrder).toEqual(['put', 'mark-sent'])
    })

    it('processes multiple files and disconnects once', async () => {
      const exports = [
        makeExport({ _id: 'id-1' }),
        makeExport({ _id: 'id-2', filename: 'job-def456.xml' }),
      ]
      mockListNew.mockResolvedValueOnce({ ok: true, data: exports })
      mockDownload.mockResolvedValue({
        ok: true,
        data: { content: Buffer.from(''), filename: 'file.xml' },
      })
      mockMarkSent.mockResolvedValue({
        ok: true,
        data: { ...exports[0], status: 'SENT', sentAt: '' },
      })

      await transferStralforsFiles()

      expect(mockSftpInstance.put).toHaveBeenCalledTimes(2)
      expect(mockMarkSent).toHaveBeenCalledTimes(2)
      expect(mockSftpInstance.end).toHaveBeenCalledTimes(1)
    })
  })

  describe('error isolation', () => {
    it('continues with remaining files when one download fails', async () => {
      const exports = [
        makeExport({ _id: 'id-1' }),
        makeExport({ _id: 'id-2', filename: 'job-def456.xml' }),
      ]
      mockListNew.mockResolvedValueOnce({ ok: true, data: exports })
      mockDownload
        .mockResolvedValueOnce({ ok: false, err: 'not-found' })
        .mockResolvedValueOnce({
          ok: true,
          data: { content: Buffer.from(''), filename: 'job-def456.xml' },
        })
      mockMarkSent.mockResolvedValueOnce({
        ok: true,
        data: { ...exports[1], status: 'SENT', sentAt: '' },
      })

      await transferStralforsFiles()

      expect(mockSftpInstance.put).toHaveBeenCalledTimes(1)
      expect(mockMarkSent).toHaveBeenCalledTimes(1)
      // one failure notification + one success summary
      expect(mockSendEmail).toHaveBeenCalledTimes(2)
    })

    it('continues with remaining files when one upload fails', async () => {
      const exports = [
        makeExport({ _id: 'id-1' }),
        makeExport({ _id: 'id-2', filename: 'job-def456.xml' }),
      ]
      mockListNew.mockResolvedValueOnce({ ok: true, data: exports })
      mockDownload.mockResolvedValue({
        ok: true,
        data: { content: Buffer.from(''), filename: 'file.xml' },
      })
      mockMarkSent.mockResolvedValue({
        ok: true,
        data: { ...exports[1], status: 'SENT', sentAt: '' },
      })
      mockSftpInstance.put
        .mockRejectedValueOnce(new Error('SFTP write error'))
        .mockResolvedValueOnce('')

      await transferStralforsFiles()

      expect(mockSftpInstance.put).toHaveBeenCalledTimes(2)
      expect(mockMarkSent).toHaveBeenCalledTimes(1)
      // one failure notification + one success summary
      expect(mockSendEmail).toHaveBeenCalledTimes(2)
    })

    it('sends failure notification when a file fails', async () => {
      const export1 = makeExport()
      mockListNew.mockResolvedValueOnce({ ok: true, data: [export1] })
      mockDownload.mockResolvedValueOnce({ ok: false, err: 'unknown' })

      await transferStralforsFiles()

      expect(mockSendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('transfer-stralfors-files'),
        expect.any(String)
      )
    })

    it('sends failure notification and throws when listing exports fails', async () => {
      mockListNew.mockResolvedValueOnce({ ok: false, err: 'unknown' })

      await expect(transferStralforsFiles()).rejects.toThrow(
        'Failed to fetch outbound exports from Tenfast'
      )

      expect(mockSendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('transfer-stralfors-files'),
        expect.any(String)
      )
    })

    it('sends failure notification and throws when SFTP connect fails', async () => {
      const export1 = makeExport()
      mockListNew.mockResolvedValueOnce({ ok: true, data: [export1] })
      mockSftpInstance.connect.mockRejectedValueOnce(
        new Error('Connection refused')
      )

      await expect(transferStralforsFiles()).rejects.toThrow('Connection refused')

      expect(mockSendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('transfer-stralfors-files'),
        expect.any(String)
      )
    })

    it('disconnects from SFTP even when a file fails', async () => {
      const export1 = makeExport()
      mockListNew.mockResolvedValueOnce({ ok: true, data: [export1] })
      mockDownload.mockResolvedValueOnce({ ok: false, err: 'unknown' })

      await transferStralforsFiles()

      expect(mockSftpInstance.end).toHaveBeenCalled()
    })

    it('success summary includes failed count when some files failed', async () => {
      const exports = [
        makeExport({ _id: 'id-1' }),
        makeExport({ _id: 'id-2', filename: 'job-def456.xml' }),
      ]
      mockListNew.mockResolvedValueOnce({ ok: true, data: exports })
      mockDownload
        .mockResolvedValueOnce({ ok: false, err: 'unknown' })
        .mockResolvedValueOnce({
          ok: true,
          data: { content: Buffer.from(''), filename: 'job-def456.xml' },
        })
      mockMarkSent.mockResolvedValueOnce({
        ok: true,
        data: { ...exports[1], status: 'SENT', sentAt: '' },
      })

      await transferStralforsFiles()

      const successCall = mockSendEmail.mock.calls.find((call) =>
        call[1].includes('klar')
      )
      expect(successCall?.[2]).toContain('Överförda filer: 1')
      expect(successCall?.[2]).toContain('Misslyckade filer: 1')
    })
  })
})
