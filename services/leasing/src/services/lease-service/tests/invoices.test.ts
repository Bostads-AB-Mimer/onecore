import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as invoiceAdapter from '../adapters/invoices-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

jest.mock('knex', () => () => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation((callback: any) =>
    callback([
      //unpaid invoice
      {
        invoiceId: '552303315030452',
        leaseId: '705-025-03-0205/01',
        amount: 7687.77,
        fromDate: new Date('2023-03-01T00:00:00.000Z'),
        toDate: new Date('2023-03-31T00:00:00.000Z'),
        invoiceDate: new Date('2023-02-15T00:00:00.000Z'),
        expirationDate: new Date('2023-02-28T00:00:00.000Z'),
        debitStatus: 5,
        paymentStatus: 1,
        transactionTypeName: 'HYRA',
      },
      //unpaid invoice
      {
        invoiceId: '552303315030451',
        leaseId: '705-025-03-0205/01',
        amount: 7687.77,
        fromDate: new Date('2023-03-01T00:00:00.000Z'),
        toDate: new Date('2023-03-31T00:00:00.000Z'),
        invoiceDate: new Date('2023-02-15T00:00:00.000Z'),
        expirationDate: new Date('2023-02-28T00:00:00.000Z'),
        debitStatus: 5,
        paymentStatus: 1,
        transactionTypeName: 'HYRA',
      },
      //paid invoice
      {
        invoiceId: '552211309521354',
        leaseId: '705-025-03-0205/01',
        amount: 7028.83,
        fromDate: new Date('2022-11-01T00:00:00.000Z'),
        toDate: new Date('2022-11-30T00:00:00.000Z'),
        invoiceDate: new Date('2022-10-13T00:00:00.000Z'),
        expirationDate: new Date('2022-10-31T00:00:00.000Z'),
        debitStatus: 5,
        paymentStatus: 3,
        transactionTypeName: 'HYRA',
      },
      // Scenario: invoice is handled by debt collector
      // Unpaid invoice with amount 0
      {
        invoiceId: '1',
        leaseId: '705-025-03-0205/01',
        amount: 0,
        fromDate: new Date('2022-11-01T00:00:00.000Z'),
        toDate: new Date('2022-11-30T00:00:00.000Z'),
        invoiceDate: new Date('2022-10-13T00:00:00.000Z'),
        expirationDate: new Date('2022-10-31T00:00:00.000Z'),
        debitStatus: 5,
        paymentStatus: 1,
        transactionTypeName: 'HYRA',
      },
      // Paid invoice with amount 0
      {
        invoiceId: '1',
        leaseId: '705-025-03-0205/01',
        amount: 7028.83,
        fromDate: new Date('2022-11-01T00:00:00.000Z'),
        toDate: new Date('2022-11-30T00:00:00.000Z'),
        invoiceDate: new Date('2022-10-13T00:00:00.000Z'),
        expirationDate: new Date('2022-10-31T00:00:00.000Z'),
        debitStatus: 5,
        paymentStatus: 3,
        transactionTypeName: 'HYRA',
      },
      // End of scenario
    ])
  ),
}))
describe('invoices-service', () => {
  describe('GET /getInvoicesByContactCode', () => {
    it('responds with an object of invoices', async () => {
      const getInvoicesSpy = jest.spyOn(
        invoiceAdapter,
        'getInvoicesByContactCode'
      )

      const res = await request(app.callback()).get(
        '/contact/invoices/contactCode/contactKey'
      )
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Object)
      expect(getInvoicesSpy).toHaveBeenCalled()
      expect(res.body.data.unpaidInvoices).toBeDefined()
      expect(res.body.data.paidInvoices).toBeDefined()
    })
  })

  describe('GET /getUnpaidInvoicesByContactCode', () => {
    it('responds with an object of invoices', async () => {
      const getInvoicesSpy = jest.spyOn(
        invoiceAdapter,
        'getUnpaidInvoicesByContactCode'
      )

      const res = await request(app.callback()).get(
        '/contact/unpaidInvoices/contactCode/contactKey'
      )
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Object)
      expect(getInvoicesSpy).toHaveBeenCalled()
      expect(res.body.data.invoices).toBeDefined()
      expect(res.body.data.numberOfUnpaidInvoices).toBeDefined()
      expect(res.body.data.accumulatedLastDebitDaysSinceToday).toBeDefined()
    })
  })

  describe('getInvoicesByContactCode', () => {
    it('should return unpaid and paid invoices for a contact', async () => {
      const result = await invoiceAdapter.getInvoicesByContactCode('contactKey')

      expect(result).toBeDefined()
      expect(result?.paidInvoices).toHaveLength(2)
      expect(result?.unpaidInvoices).toHaveLength(2)
    })

    it('should only return the paid invoice if it is found as both paid and unpaid', async () => {
      const result = await invoiceAdapter.getInvoicesByContactCode('contactKey')

      expect(
        result?.paidInvoices?.find((invoice) => invoice.invoiceId == '1')
      ).toBeDefined()
      expect(
        result?.unpaidInvoices?.find((invoice) => invoice.invoiceId == '1')
      ).toBeUndefined()
    })
  })

  describe('getUnpaidInvoicesByContactCode', () => {
    it('should return unpaid invoices for a contact', async () => {
      const result = await invoiceAdapter.getUnpaidInvoicesByContactCode(
        'contactKey'
      )

      expect(result).toBeDefined()
      expect(result?.unpaidInvoices).toHaveLength(2)
      expect(result?.numberOfUnpaidInvoices).toEqual(2)
      expect(result?.accumulatedLastDebitDaysSinceToday).toBeGreaterThan(
        0
      )
    })
  })
})
