jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
  }
})

import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import { routes } from '../../index'
import * as invoiceAdapter from '../../adapters/xpand/invoices-adapter'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('GET /getInvoicesByContactCode', () => {
  it('responds with an object of invoices', async () => {
    const getInvoicesSpy = jest
      .spyOn(invoiceAdapter, 'getInvoicesByContactCode')
      .mockResolvedValueOnce(factory.invoice.buildList(1))

    const res = await request(app.callback()).get(
      '/contact/invoices/contactCode/contactKey'
    )
    expect(res.status).toBe(200)
    expect(getInvoicesSpy).toHaveBeenCalled()
    expect(res.body.data).toBeDefined()
    expect(res.body.data).toBeInstanceOf(Array)
  })
})

describe('GET /getUnpaidInvoicesByContactCode', () => {
  it('responds with an object of invoices', async () => {
    const getInvoicesSpy = jest
      .spyOn(invoiceAdapter, 'getUnpaidInvoicesByContactCode')
      .mockResolvedValueOnce(factory.invoice.buildList(1))

    const res = await request(app.callback()).get(
      '/contact/unpaidInvoices/contactCode/contactKey'
    )
    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Object)
    expect(getInvoicesSpy).toHaveBeenCalled()
    expect(res.body.data).toBeDefined()
  })
})
