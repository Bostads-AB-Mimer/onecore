import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import * as tenfastAdapter from '@src/common/adapters/tenfast/tenfast-adapter'
import * as xpandDbAdapter from '@src/services/invoice-service/adapters/xpand-db-adapter'
import * as invoiceDataDbAdapter from '@src/services/invoice-service/adapters/invoice-data-db-adapter'
import * as invoiceService from '@src/services/invoice-service/service'
import { routes } from '@src/services/invoice-service'
import { InvoiceWithAccounting } from '@src/common/types/typesv2'

jest.mock('@src/common/config', () => ({
  __esModule: true,
  ...jest.requireActual('@src/common/config'),
  default: {
    ...jest.requireActual('@src/common/config').default,
    get companies() {
      return [{ name: 'Mimer', xpandId: '001', tenfastId: 'tf-001' }]
    },
  },
}))

const app = new Koa()
const router = new KoaRouter()
app.use(bodyParser())
routes(router)
app.use(router.routes())

const URL = '/accounting/import-invoices/001'

const buildInvoice = (
  invoiceId: string,
  recipientContactCode: string
): InvoiceWithAccounting =>
  ({
    invoiceId,
    leaseIds: ['705-025-03-0205/01'],
    recipientContactCode,
    recipientName: 'Test Tenant',
    amount: 1000,
    totalVat: 0,
    roundoff: 0,
    fromDate: new Date('2026-07-01T00:00:00.000Z'),
    toDate: new Date('2026-07-31T00:00:00.000Z'),
    invoiceDate: new Date('2026-06-15T00:00:00.000Z'),
    expirationDate: new Date('2026-06-30T00:00:00.000Z'),
    invoiceRows: [],
  }) as unknown as InvoiceWithAccounting

const invoiceIds = (invoices: InvoiceWithAccounting[]) =>
  invoices.map((invoice) => invoice.invoiceId)

describe('POST /accounting/import-invoices/:companyId, customer guard', () => {
  let lookup: jest.SpyInstance
  let createAccounting: jest.SpyInstance
  let uploadCsvFiles: jest.SpyInstance
  let markAsExported: jest.SpyInstance

  const givenInvoices = (invoices: InvoiceWithAccounting[]) =>
    jest
      .spyOn(tenfastAdapter, 'getInvoicesNotExported')
      .mockResolvedValue({ ok: true, data: { invoices, errors: [] } })

  const givenExistingCustomers = (codes: string[]) =>
    lookup.mockImplementation(async (requested: string[]) =>
      requested.filter((code) => codes.includes(code))
    )

  beforeEach(() => {
    jest
      .spyOn(invoiceDataDbAdapter, 'getCounterPartCustomers')
      .mockResolvedValue([])
    jest
      .spyOn(xpandDbAdapter, 'enrichInvoiceWithAccounting')
      .mockResolvedValue(undefined as never)
    jest
      .spyOn(xledgerAdapter, 'setInvoiceRowsTaxRule')
      .mockResolvedValue(undefined as never)
    lookup = jest.spyOn(xledgerAdapter, 'getExistingCustomerCodes')
    createAccounting = jest
      .spyOn(invoiceService, 'createAccounting')
      .mockResolvedValue({
        aggregateAccountingCsv: ['aggregate'],
        ledgerAccountingCsv: ['ledger'],
        errors: [],
      })
    uploadCsvFiles = jest
      .spyOn(invoiceService, 'uploadCsvFiles')
      .mockResolvedValue(undefined)
    markAsExported = jest
      .spyOn(tenfastAdapter, 'markInvoicesAsExported')
      .mockResolvedValue([])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('holds back the invoice whose recipient is missing in Xledger and exports the rest', async () => {
    givenInvoices([buildInvoice('1001', 'P1'), buildInvoice('1002', 'P2')])
    givenExistingCustomers(['P1'])

    const res = await request(app.callback()).post(URL)

    expect(res.status).toBe(200)
    expect(res.body.successfulInvoices).toEqual(['1001'])
    expect(res.body.missingCustomerCodes).toEqual(['P2'])
    expect(res.body.errors).toEqual([
      expect.objectContaining({
        invoiceNumber: '1002',
        code: 'missing-customer',
      }),
    ])
    expect(invoiceIds(createAccounting.mock.calls[0][0])).toEqual(['1001'])
    expect(uploadCsvFiles).toHaveBeenCalledTimes(1)
    expect(invoiceIds(markAsExported.mock.calls[0][0])).toEqual(['1001'])
  })

  it('lists a missing recipient once and holds back all of its invoices', async () => {
    givenInvoices([
      buildInvoice('1001', 'P1'),
      buildInvoice('1002', 'P2'),
      buildInvoice('1003', 'P2'),
    ])
    givenExistingCustomers(['P1'])

    const res = await request(app.callback()).post(URL)

    expect(res.status).toBe(200)
    expect(res.body.missingCustomerCodes).toEqual(['P2'])
    expect(res.body.successfulInvoices).toEqual(['1001'])
    expect(
      res.body.errors.map((e: { invoiceNumber: string; code: string }) => [
        e.invoiceNumber,
        e.code,
      ])
    ).toEqual([
      ['1002', 'missing-customer'],
      ['1003', 'missing-customer'],
    ])
    expect(invoiceIds(markAsExported.mock.calls[0][0])).toEqual(['1001'])
  })

  it('skips and marks an internal recipient as before, without looking it up', async () => {
    givenInvoices([buildInvoice('1001', 'P1'), buildInvoice('1009', 'I9')])
    givenExistingCustomers(['P1'])

    const res = await request(app.callback()).post(URL)

    expect(res.status).toBe(200)
    expect(res.body.skippedInvoices).toEqual(['1009'])
    expect(res.body.successfulInvoices).toEqual(['1001'])
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(lookup).toHaveBeenCalledWith(['P1'])
    expect(invoiceIds(markAsExported.mock.calls[0][0])).toEqual([
      '1001',
      '1009',
    ])
  })

  it('exports and marks every invoice when every recipient exists', async () => {
    givenInvoices([buildInvoice('1001', 'P1'), buildInvoice('1002', 'P2')])
    givenExistingCustomers(['P1', 'P2'])

    const res = await request(app.callback()).post(URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      errors: [],
      successfulInvoices: ['1001', '1002'],
      skippedInvoices: [],
      markFailures: [],
      missingCustomerCodes: [],
    })
    expect(uploadCsvFiles).toHaveBeenCalledTimes(1)
    expect(invoiceIds(markAsExported.mock.calls[0][0])).toEqual([
      '1001',
      '1002',
    ])
  })

  it('uploads and marks nothing when every invoice is held back', async () => {
    givenInvoices([buildInvoice('1002', 'P2'), buildInvoice('1003', 'P3')])
    givenExistingCustomers([])

    const res = await request(app.callback()).post(URL)

    expect(res.status).toBe(200)
    expect(res.body.successfulInvoices).toEqual([])
    expect(res.body.missingCustomerCodes).toEqual(['P2', 'P3'])
    expect(createAccounting).not.toHaveBeenCalled()
    expect(uploadCsvFiles).not.toHaveBeenCalled()
    expect(markAsExported).not.toHaveBeenCalled()
  })

  it('responds 500 export-failed and uploads nothing when the Xledger lookup throws', async () => {
    givenInvoices([buildInvoice('1001', 'P1')])
    lookup.mockRejectedValue(new Error('xledger down'))

    const res = await request(app.callback()).post(URL)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('export-failed')
    expect(uploadCsvFiles).not.toHaveBeenCalled()
    expect(markAsExported).not.toHaveBeenCalled()
  })
})
