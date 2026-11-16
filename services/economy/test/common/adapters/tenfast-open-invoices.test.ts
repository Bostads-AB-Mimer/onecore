import axios from 'axios'
import assert from 'node:assert'

import {
  getOpenInvoices,
  toSwedishDay,
} from '@src/common/adapters/tenfast/tenfast-adapter'

jest.mock('axios')
const mockAxios = axios as jest.Mocked<typeof axios>

jest.mock('@src/common/config', () => ({
  tenfast: {
    baseUrl: 'https://test-api.tenfast.com',
    apiKey: 'test-api-key',
    companyId: 'test-hyresvard-id',
  },
}))

const buildSearchInvoice = (overrides: Record<string, unknown> = {}) => ({
  _id: 'invoice-1',
  reference: 55123456,
  ocrNumber: '5512345601',
  activatedAt: '2026-10-14T22:00:00.000Z',
  expectedInvoiceDate: '2026-10-10T22:00:00.000Z',
  createdAt: '2026-10-01T08:00:00.000Z',
  due: '2026-10-31T23:00:00.000Z',
  amount: 8000.5,
  amountPaid: 3000.2,
  state: 'delvis-betald',
  snapshot: {
    hyresgaster: [
      { externalId: 'F000001', isCompany: true },
      { externalId: 'P123456', isCompany: false },
    ],
    hyresobjekt: [{ externalId: '306-008-01-0201' }],
    avtal: [{ externalId: '306-008-01-0201/02' }],
  },
  avtal: ['lease-object-id'],
  ...overrides,
})

const page = (records: unknown[], next: string | null = null) => ({
  status: 200,
  data: { records, next, prev: null, totalCount: records.length },
})

describe(getOpenInvoices, () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('searches the open states and maps an invoice to the neutral shape', async () => {
    mockAxios.request.mockResolvedValueOnce(page([buildSearchInvoice()]))

    const result = await getOpenInvoices()

    expect(mockAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/v1/hyresvard/hyror/search',
        params: {
          hyresvard: 'test-hyresvard-id',
          limit: 1000,
          'filter[state]':
            'ny,ej-avprickad,forsenad,delvis-betald,pamind,gracePeriod',
        },
      })
    )
    assert(result.ok)
    expect(result.data).toEqual([
      {
        invoiceNumber: '55123456',
        ocr: '5512345601',
        // Midnight Swedish time, sent as UTC the day before.
        invoiceDate: '2026-10-15',
        dueDate: '2026-11-01',
        amount: 8000.5,
        remainingAmount: 5000.3,
        rentalObjectCode: '306-008-01-0201',
        leaseId: '306-008-01-0201/02',
        // The person, not the company.
        contactCode: 'P123456',
        state: 'partially-paid',
      },
    ])
  })

  it('leaves out invoices with nothing left to pay and states that are not open', async () => {
    mockAxios.request.mockResolvedValueOnce(
      page([
        buildSearchInvoice({ _id: 'paid', amountPaid: 8000.5 }),
        buildSearchInvoice({ _id: 'overpaid', amountPaid: 9000 }),
        buildSearchInvoice({ _id: 'betald', state: 'betald' }),
        buildSearchInvoice({ _id: 'open', reference: '55000001' }),
      ])
    )

    const result = await getOpenInvoices()

    assert(result.ok)
    expect(result.data.map((invoice) => invoice.invoiceNumber)).toEqual([
      '55000001',
    ])
  })

  it('falls back to the populated leases and the lease ID when the snapshot lacks them', async () => {
    mockAxios.request.mockResolvedValueOnce(
      page([
        buildSearchInvoice({
          reference: undefined,
          activatedAt: null,
          snapshot: undefined,
          avtal: [
            {
              externalId: '705-021-03-0101/01',
              hyresgaster: [{ externalId: 'P654321' }],
            },
          ],
        }),
      ])
    )

    const result = await getOpenInvoices()

    assert(result.ok)
    expect(result.data[0]).toMatchObject({
      invoiceNumber: '5512345601',
      invoiceDate: '2026-10-11',
      leaseId: '705-021-03-0101/01',
      rentalObjectCode: '705-021-03-0101',
      contactCode: 'P654321',
    })
  })

  it('follows the next cursor across pages', async () => {
    mockAxios.request
      .mockResolvedValueOnce(
        page([buildSearchInvoice({ reference: '1' })], 'cursor-2')
      )
      .mockResolvedValueOnce(page([buildSearchInvoice({ reference: '2' })]))

    const result = await getOpenInvoices()

    assert(result.ok)
    expect(result.data.map((invoice) => invoice.invoiceNumber)).toEqual([
      '1',
      '2',
    ])
    expect(mockAxios.request.mock.calls[1][0].params).toMatchObject({
      paginate: 'cursor-2',
    })
  })

  it('fails, never gives a partial list, when a later page fails', async () => {
    mockAxios.request
      .mockResolvedValueOnce(page([buildSearchInvoice()], 'cursor-2'))
      .mockResolvedValueOnce({ status: 500, data: {} })

    const result = await getOpenInvoices()

    expect(result).toEqual({ ok: false, err: 'request-failed' })
  })
})

describe(toSwedishDay, () => {
  it('gives the day in Swedish time, summer and winter', () => {
    expect(toSwedishDay('2026-11-30T23:00:00.000Z')).toBe('2026-12-01')
    expect(toSwedishDay('2026-06-30T22:00:00.000Z')).toBe('2026-07-01')
  })
})
