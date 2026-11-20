jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  // createExcelExport lazy-loads exceljs with a dynamic import, which Jest's
  // CJS transform can't run. The test checks what it is given instead.
  createExcelExport: jest.fn(),
}))

import KoaRouter from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import request from 'supertest'
import { economy, LeaseStatus } from '@onecore/types'
import * as utilities from '@onecore/utilities'

import * as economyAdapter from '../../../adapters/economy-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import { contactsAdapter } from '../../../adapters/contacts-adapter'
import { requireRole } from '../../../middlewares/keycloak-auth'
import { requiredRolesFor } from '../../../middlewares/route-roles'
import * as factory from '../../../../test/factories'
import { routes } from '../index'

const buildInvoice = (
  overrides: Partial<economy.OpenInvoice> = {}
): economy.OpenInvoice => ({
  invoiceNumber: '55123456',
  ocr: '5512345601',
  invoiceDate: '2026-10-15',
  dueDate: '2026-11-01',
  amount: 8000,
  remainingAmount: 5000,
  rentalObjectCode: '306-008-01-0201',
  leaseId: '306-008-01-0201/02',
  contactCode: 'P100001',
  state: 'overdue',
  costCentre: '61110',
  ...overrides,
})

const appWithRoles = (roles: string[]) => {
  const app = new Koa()
  const router = new KoaRouter()
  routes(router)
  app.use(bodyParser())
  app.use(async (ctx, next) => {
    ctx.state.user = { preferred_username: 'staff1', realm_access: { roles } }
    await next()
  })
  app.use(async (ctx, next) =>
    requireRole(requiredRolesFor(ctx.path, ctx.method))(ctx, next)
  )
  app.use(router.routes())
  return app
}

const reader = () => appWithRoles(['open-invoices:read']).callback()

const mockSources = () => {
  jest
    .spyOn(economyAdapter, 'getOpenInvoices')
    .mockResolvedValue({ ok: true, data: [buildInvoice()] })
  jest.spyOn(leasingAdapter, 'getLeaseStatuses').mockResolvedValue({
    ok: true,
    data: {
      statuses: [
        { leaseId: '306-008-01-0201/02', status: LeaseStatus.Current },
      ],
      notFoundLeaseIds: [],
    },
  })
  jest.spyOn(contactsAdapter, 'getByContactCodeBatch').mockResolvedValue({
    ok: true,
    data: [factory.domainContact.build({ contactCode: 'P100001' })],
  })
}

afterEach(jest.restoreAllMocks)

describe('GET /reports/open-invoices', () => {
  it('lists the open invoices with lease status and name', async () => {
    mockSources()

    const res = await request(reader()).get('/reports/open-invoices')

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual([
      expect.objectContaining({
        invoiceNumber: '55123456',
        state: 'overdue',
        costCentre: '61110',
        leaseStatus: LeaseStatus.Current,
        fullName: 'Kansen, Knut',
        daysPastDue: expect.any(Number),
      }),
    ])
  })

  it('answers 503 cache-warming with Retry-After while leasing loads its leases', async () => {
    mockSources()
    jest
      .spyOn(leasingAdapter, 'getLeaseStatuses')
      .mockResolvedValue({ ok: false, err: 'cache-warming' })

    const res = await request(reader()).get('/reports/open-invoices')

    expect(res.status).toBe(503)
    expect(res.headers['retry-after']).toBe('30')
    expect(res.body.error).toBe('cache-warming')
  })

  it('answers 500 unknown on an unexpected answer from economy', async () => {
    jest
      .spyOn(economyAdapter, 'getOpenInvoices')
      .mockResolvedValue({ ok: false, err: 'unknown' })

    const res = await request(reader()).get('/reports/open-invoices')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('unknown')
  })
})

describe('GET /reports/open-invoices/export', () => {
  it('builds an Excel file in the unpaid invoice report columns', async () => {
    mockSources()
    const createExcelExport = jest
      .mocked(utilities.createExcelExport)
      .mockResolvedValue(Buffer.from('xlsx'))

    const res = await request(reader()).get('/reports/open-invoices/export')

    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="restlista-\d{4}-\d{2}-\d{2}\.xlsx"/
    )

    const [options] = createExcelExport.mock.calls[0]
    expect(options.sheetName).toBe('Restlista')
    expect(options.columns.map((column) => column.header)).toEqual([
      'Fakturanummer',
      'Fakturadatum',
      'Förfallodatum',
      'Totalbelopp',
      'Skuld',
      'Dagar sen förfallodatum',
      'Objektsnummer',
      'Namn',
      'Kod',
      'Adress',
      'Status',
      'Kostnadsställe',
    ])
    expect(options.rowMapper(options.data[0])).toMatchObject({
      invoiceId: '55123456',
      leaseStatus: 'Gällande',
    })
  })

  it('answers 500 unknown when the file cannot be built', async () => {
    mockSources()
    jest
      .mocked(utilities.createExcelExport)
      .mockRejectedValue(new Error('out of memory'))

    const res = await request(reader()).get('/reports/open-invoices/export')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('unknown')
  })

  it('answers 503 as JSON when a source fails', async () => {
    jest
      .spyOn(economyAdapter, 'getOpenInvoices')
      .mockResolvedValue({ ok: false, err: 'upstream-failed' })

    const res = await request(reader()).get('/reports/open-invoices/export')

    expect(res.status).toBe(503)
    expect(res.body.error).toBe('upstream-failed')
  })
})

describe('open invoice roles', () => {
  it('answers with 403 without open-invoices:read', async () => {
    const spy = jest.spyOn(economyAdapter, 'getOpenInvoices')

    const res = await request(
      appWithRoles(['api-access', 'home-insurance:read']).callback()
    ).get('/reports/open-invoices')

    expect(res.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })
})
