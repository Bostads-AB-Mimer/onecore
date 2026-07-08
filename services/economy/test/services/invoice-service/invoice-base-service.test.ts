import { logger } from '@onecore/utilities'

jest.mock(
  '@src/services/invoice-service/adapters/invoice-base-db-adapter',
  () => ({
    getInvoiceBases: jest.fn(),
    getInvoiceBaseItems: jest.fn(),
    createInvoiceBase: jest.fn(),
  })
)
jest.mock('@src/services/common/adapters/xledger-adapter', () => ({
  getInvoiceBaseItems: jest.fn(),
}))

import * as invoiceBaseDbAdapterImport from '@src/services/invoice-service/adapters/invoice-base-db-adapter'
import * as xledgerAdapterImport from '@src/services/common/adapters/xledger-adapter'
import {
  getInvoiceBases,
  createInvoiceBase,
} from '@src/services/invoice-service/invoice-base-service'

const invoiceBaseDbAdapter = invoiceBaseDbAdapterImport as jest.Mocked<
  typeof invoiceBaseDbAdapterImport
>
const xledgerAdapter = xledgerAdapterImport as jest.Mocked<
  typeof xledgerAdapterImport
>

describe('invoice-base-service', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getInvoiceBases', () => {
    it('merges invoice base with matching xledger items', async () => {
      invoiceBaseDbAdapter.getInvoiceBases.mockResolvedValue([
        {
          id: 1,
          externalIdentifier: 'ext-1',
          contactCode: 'P12345',
          leaseId: '',
          createdAt: new Date('2025-01-01'),
        },
      ])
      invoiceBaseDbAdapter.getInvoiceBaseItems.mockResolvedValue([
        { InvoiceBaseId: 1, XledgerDbId: 'xdb-1' },
      ])
      xledgerAdapter.getInvoiceBaseItems.mockResolvedValue([
        {
          contactCode: 'P12345',
          externalIdentifier: 'ext-1',
          xledgerDbId: 'xdb-1',
          text: 'Row 1',
          amount: 100,
          unitPrice: 100,
          quantity: 1,
          ourReference: { name: 'Ref Name' },
          attachment: { fileName: 'file.pdf', url: 'http://example.com' },
          headerInfo: 'Header',
          invoiceDate: new Date('2025-01-02'),
          comment: 'secret comment',
        },
        {
          contactCode: 'P12345',
          externalIdentifier: 'ext-1',
          xledgerDbId: 'xdb-2',
          text: 'Row 2',
          amount: 50,
          unitPrice: 50,
          quantity: 1,
          ourReference: { name: 'Ref Name' },
          attachment: undefined,
          headerInfo: 'Header',
          invoiceDate: new Date('2025-01-02'),
          comment: 'secret comment',
        },
      ])

      const result = await getInvoiceBases({})

      expect(invoiceBaseDbAdapter.getInvoiceBaseItems).toHaveBeenCalledWith([1])
      expect(xledgerAdapter.getInvoiceBaseItems).toHaveBeenCalledWith(['xdb-1'])
      expect(result).toEqual([
        {
          id: 1,
          externalIdentifier: 'ext-1',
          contactCode: 'P12345',
          leaseId: '',
          createdAt: new Date('2025-01-01'),
          ourReference: { name: 'Ref Name' },
          attachment: { fileName: 'file.pdf', url: 'http://example.com' },
          headerInfo: 'Header',
          invoiceDate: new Date('2025-01-02'),
          totalAmount: 150,
          comment: 'secret comment',
          items: [
            {
              xledgerDbId: 'xdb-1',
              text: 'Row 1',
              amount: 100,
              unitPrice: 100,
              quantity: 1,
            },
            {
              xledgerDbId: 'xdb-2',
              text: 'Row 2',
              amount: 50,
              unitPrice: 50,
              quantity: 1,
            },
          ],
        },
      ])
    })

    it('excludes invoice base and logs error when no matching xledger items found', async () => {
      const loggerErrorSpy = jest.spyOn(logger, 'error')
      invoiceBaseDbAdapter.getInvoiceBases.mockResolvedValue([
        {
          id: 1,
          externalIdentifier: 'ext-1',
          contactCode: 'P12345',
          leaseId: '',
          createdAt: new Date('2025-01-01'),
        },
      ])
      invoiceBaseDbAdapter.getInvoiceBaseItems.mockResolvedValue([
        { InvoiceBaseId: 1, XledgerDbId: 'xdb-1' },
      ])
      xledgerAdapter.getInvoiceBaseItems.mockResolvedValue([])

      const result = await getInvoiceBases({})

      expect(result).toEqual([])
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'No invoice base items found for invoice base ext-1'
      )
    })

    it('returns empty array when no invoice bases exist', async () => {
      invoiceBaseDbAdapter.getInvoiceBases.mockResolvedValue([])
      invoiceBaseDbAdapter.getInvoiceBaseItems.mockResolvedValue([])
      xledgerAdapter.getInvoiceBaseItems.mockResolvedValue([])

      const result = await getInvoiceBases({})

      expect(result).toEqual([])
      expect(invoiceBaseDbAdapter.getInvoiceBaseItems).toHaveBeenCalledWith([])
      expect(xledgerAdapter.getInvoiceBaseItems).toHaveBeenCalledWith([])
    })

    it('passes query options through to the db adapter', async () => {
      invoiceBaseDbAdapter.getInvoiceBases.mockResolvedValue([])
      invoiceBaseDbAdapter.getInvoiceBaseItems.mockResolvedValue([])
      xledgerAdapter.getInvoiceBaseItems.mockResolvedValue([])

      const options = {
        from: new Date('2025-01-01'),
        to: new Date('2025-02-01'),
        skip: 10,
        pageSize: 20,
      }

      await getInvoiceBases(options)

      expect(invoiceBaseDbAdapter.getInvoiceBases).toHaveBeenCalledWith(options)
    })
  })

  describe('createInvoiceBase', () => {
    it('delegates to the db adapter', async () => {
      const payload = {
        contactCode: 'P12345',
        externalIdentifier: 'ext-1',
        leaseId: '123-456',
        invoiceBaseItemXledgerDbIds: ['xdb-1', 'xdb-2'],
      }
      invoiceBaseDbAdapter.createInvoiceBase.mockResolvedValue({
        ok: true,
        data: 'result',
      })

      const result = await createInvoiceBase(payload)

      expect(invoiceBaseDbAdapter.createInvoiceBase).toHaveBeenCalledWith(
        payload
      )
      expect(result).toEqual({ ok: true, data: 'result' })
    })
  })
})
