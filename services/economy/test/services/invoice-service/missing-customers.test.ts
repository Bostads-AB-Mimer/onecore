import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import * as tenfastAdapter from '@src/common/adapters/tenfast/tenfast-adapter'
import { routes } from '@src/services/invoice-service'

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

const URL = '/accounting/invoice-recipients/001/missing-customers'

describe('GET /accounting/invoice-recipients/:companyId/missing-customers', () => {
  const getRecipients = () =>
    jest.spyOn(tenfastAdapter, 'getRecipientCodesOfInvoicesNotExported')
  const lookup = () => jest.spyOn(xledgerAdapter, 'getExistingCustomerCodes')

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('lists external recipients that Xledger lacks, leaving out internal ones', async () => {
    const recipients = getRecipients().mockResolvedValue({
      ok: true,
      data: ['P1', 'P2', 'I9'],
    })
    const existing = lookup().mockResolvedValue(['P1'])

    const res = await request(app.callback()).get(URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ recipients: 2, missingCustomerCodes: ['P2'] })
    expect(recipients).toHaveBeenCalledWith(
      expect.objectContaining({ xpandId: '001', tenfastId: 'tf-001' })
    )
    expect(existing).toHaveBeenCalledWith(['P1', 'P2'])
  })

  it('does not call Xledger when only internal recipients exist', async () => {
    getRecipients().mockResolvedValue({ ok: true, data: ['I1', 'I9'] })
    const existing = lookup().mockResolvedValue([])

    const res = await request(app.callback()).get(URL)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ recipients: 0, missingCustomerCodes: [] })
    expect(existing).not.toHaveBeenCalled()
  })

  it('responds 404 unknown-company for an unknown company id', async () => {
    const recipients = getRecipients()

    const res = await request(app.callback()).get(
      '/accounting/invoice-recipients/999/missing-customers'
    )

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('unknown-company')
    expect(recipients).not.toHaveBeenCalled()
  })

  it('responds 502 tenfast-failed when the Tenfast walk fails', async () => {
    getRecipients().mockResolvedValue({ ok: false, err: 'request-failed' })
    const existing = lookup()

    const res = await request(app.callback()).get(URL)

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('tenfast-failed')
    expect(existing).not.toHaveBeenCalled()
  })

  it('responds 502 xledger-failed when the Xledger lookup throws, never an empty list', async () => {
    getRecipients().mockResolvedValue({ ok: true, data: ['P1'] })
    lookup().mockRejectedValue(new Error('boom'))

    const res = await request(app.callback()).get(URL)

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('xledger-failed')
    expect(res.body.missingCustomerCodes).toBeUndefined()
  })
})
