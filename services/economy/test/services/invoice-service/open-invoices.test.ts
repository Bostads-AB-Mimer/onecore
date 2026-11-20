import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { economy } from '@onecore/types'

import * as tenfastAdapter from '@src/common/adapters/tenfast/tenfast-adapter'
import * as commonXpandAdapter from '@src/services/common/adapters/xpand-db-adapter'
import * as invoiceService from '@src/services/invoice-service/service'
import { routes } from '@src/services/invoice-service'

const app = new Koa()
const router = new KoaRouter()
app.use(bodyParser())
routes(router)
app.use(router.routes())

const buildOpenInvoice = (
  overrides: Partial<Omit<economy.OpenInvoice, 'costCentre'>> = {}
): Omit<economy.OpenInvoice, 'costCentre'> => ({
  invoiceNumber: '55123456',
  ocr: '5512345601',
  invoiceDate: '2026-10-15',
  dueDate: '2026-11-01',
  amount: 8000,
  remainingAmount: 5000,
  rentalObjectCode: '306-008-01-0201',
  leaseId: '306-008-01-0201/02',
  contactCode: 'P123456',
  state: 'overdue',
  ...overrides,
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe(invoiceService.getOpenInvoices, () => {
  it('adds the cost centre of each rental object, looked up in one batch', async () => {
    jest.spyOn(tenfastAdapter, 'getOpenInvoices').mockResolvedValueOnce({
      ok: true,
      data: [
        buildOpenInvoice(),
        buildOpenInvoice({ invoiceNumber: '2', rentalObjectCode: null }),
        buildOpenInvoice({
          invoiceNumber: '3',
          rentalObjectCode: '999-999-99-9999',
        }),
      ],
    })
    const costCentres = jest
      .spyOn(commonXpandAdapter, 'getCostCentresByRentalObjectCodes')
      .mockResolvedValueOnce({
        ok: true,
        data: new Map([['306-008-01-0201', '61110']]),
      })

    const result = await invoiceService.getOpenInvoices()

    expect(costCentres).toHaveBeenCalledTimes(1)
    expect(costCentres).toHaveBeenCalledWith([
      '306-008-01-0201',
      '999-999-99-9999',
    ])
    expect(result).toEqual({
      ok: true,
      data: [
        { ...buildOpenInvoice(), costCentre: '61110' },
        expect.objectContaining({ invoiceNumber: '2', costCentre: null }),
        expect.objectContaining({ invoiceNumber: '3', costCentre: null }),
      ],
    })
  })

  it('fails rather than leave the cost centres blank when Xpand fails', async () => {
    jest
      .spyOn(tenfastAdapter, 'getOpenInvoices')
      .mockResolvedValueOnce({ ok: true, data: [buildOpenInvoice()] })
    jest
      .spyOn(commonXpandAdapter, 'getCostCentresByRentalObjectCodes')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await invoiceService.getOpenInvoices()

    expect(result).toEqual({ ok: false, err: 'upstream-failed' })
  })
})

describe('GET /invoices/open', () => {
  it('responds with the open invoices, not as an invoice number', async () => {
    const invoices = [{ ...buildOpenInvoice(), costCentre: '61110' }]
    jest
      .spyOn(invoiceService, 'getOpenInvoices')
      .mockResolvedValueOnce({ ok: true, data: invoices })

    const res = await request(app.callback()).get('/invoices/open')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(invoices)
  })

  it('responds with 503 upstream-failed when a source fails', async () => {
    jest
      .spyOn(invoiceService, 'getOpenInvoices')
      .mockResolvedValueOnce({ ok: false, err: 'upstream-failed' })

    const res = await request(app.callback()).get('/invoices/open')

    expect(res.status).toBe(503)
    expect(res.body.error).toBe('upstream-failed')
  })
})
