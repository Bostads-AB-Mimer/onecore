import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import koaBody from 'koa-body'
import { SubmitMiscellaneousInvoiceErrorCodes } from '@onecore/types'

import { routes } from '../index'
import * as economyAdapter from '../../../adapters/economy-adapter'
import * as submitHelper from '../submit-miscellaneous-invoice'
import * as factory from '../../../../test/factories'

import { mockedMiscellaneousInvoices } from '../../../adapters/tests/economy-adapter/mocks'

jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.resetAllMocks)

describe('GET /miscellaneous-invoices', () => {
  it('responds with 400 if invalid query params', async () => {
    const res = await request(app.callback()).get(
      '/miscellaneous-invoices?pageSize=notanumber'
    )

    expect(res.status).toBe(400)
  })

  it('responds with 500 if adapter fails', async () => {
    jest
      .spyOn(economyAdapter, 'getMiscellaneousInvoices')
      .mockResolvedValueOnce({ ok: false, err: 'unknown', statusCode: 500 })

    const res = await request(app.callback()).get('/miscellaneous-invoices')

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: expect.any(String) })
  })

  it('responds with 200 and content plus pageInfo', async () => {
    jest
      .spyOn(economyAdapter, 'getMiscellaneousInvoices')
      .mockResolvedValueOnce({
        ok: true,
        data: {
          content: mockedMiscellaneousInvoices,
          pageInfo: { hasNextPage: false },
        },
      })

    const res = await request(app.callback()).get('/miscellaneous-invoices')

    expect(res.status).toBe(200)
    expect(res.body.content.content).toHaveLength(
      mockedMiscellaneousInvoices.length
    )
    expect(res.body.content.pageInfo).toEqual({ hasNextPage: false })
  })
})

describe('POST /miscellaneous-invoices', () => {
  const multipartApp = new Koa()
  const multipartRouter = new KoaRouter()
  routes(multipartRouter)
  multipartApp.use(koaBody({ multipart: true }))
  multipartApp.use(multipartRouter.routes())

  const contactCode = factory.contactsServiceContact.build().contactCode
  const invoice = {
    reference: 'Ref 1',
    invoiceDate: '2026-11-01T00:00:00.000Z',
    contactCode,
    tenantName: 'Test Testsson',
    leaseId: '123-456-789/1',
    invoiceRows: [{ amount: 1, price: '100', text: 'Rad' }],
    administrativeCosts: false,
  }

  const post = () =>
    request(multipartApp.callback())
      .post('/miscellaneous-invoices')
      .field('invoice', JSON.stringify(invoice))
      .attach('attachment', Buffer.from('%PDF-1.4'), 'underlag.pdf')

  beforeEach(() => {
    jest
      .spyOn(economyAdapter, 'submitMiscellaneousInvoice')
      .mockResolvedValue({
        ok: false,
        err: SubmitMiscellaneousInvoiceErrorCodes.XledgerCustomerNotFound,
        statusCode: 404,
      })
  })

  it('responds with 200 and the created invoice, passing the parsed invoice and file to the helper', async () => {
    const helper = jest
      .spyOn(submitHelper, 'submitMiscellaneousInvoiceCreatingCustomer')
      .mockResolvedValueOnce({ ok: true, data: [{ node: { dbId: 42 } }] })

    const res = await post()

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual({ data: [{ node: { dbId: 42 } }] })
    expect(helper).toHaveBeenCalledTimes(1)
    expect(helper).toHaveBeenCalledWith(
      invoice,
      expect.objectContaining({ originalFilename: 'underlag.pdf' })
    )
  })

  it('responds with 502 when the customer could not be created', async () => {
    jest
      .spyOn(submitHelper, 'submitMiscellaneousInvoiceCreatingCustomer')
      .mockResolvedValueOnce({
        ok: false,
        err: SubmitMiscellaneousInvoiceErrorCodes.CustomerCreationFailed,
      })

    const res = await post()

    expect(res.status).toBe(502)
    expect(res.body.type).toBe('customer-creation-failed')
    expect(res.body.status).toBe(502)
    expect(res.body.title).toMatch(/customer.*could not be created/i)
  })

  it('responds with 502 when the customer is still missing after creation', async () => {
    jest
      .spyOn(submitHelper, 'submitMiscellaneousInvoiceCreatingCustomer')
      .mockResolvedValueOnce({
        ok: false,
        err: SubmitMiscellaneousInvoiceErrorCodes.CustomerNotFoundAfterCreate,
      })

    const res = await post()

    expect(res.status).toBe(502)
    expect(res.body.type).toBe('customer-not-found-after-create')
    expect(res.body.status).toBe(502)
  })

  it('responds with 500 on an unknown error', async () => {
    jest
      .spyOn(submitHelper, 'submitMiscellaneousInvoiceCreatingCustomer')
      .mockResolvedValueOnce({
        ok: false,
        err: SubmitMiscellaneousInvoiceErrorCodes.Unknown,
      })

    const res = await post()

    expect(res.status).toBe(500)
    expect(res.body.type).toBe('unknown')
    expect(res.body.status).toBe(500)
  })
})
