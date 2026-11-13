import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { makeOkapiRouter } from 'koa-okapi-router'
import { LeaseStatus } from '@onecore/types'

import { routes } from '../index'
import * as contactsAdapterModule from '../../../../adapters/contacts-adapter'
import * as leasesAdapter from '../../../../adapters/leasing-adapter/leases'
import { Config } from '@/common/config'
import * as factory from '../../../../../test/factories'

jest.mock('../../../../adapters/contacts-adapter')
jest.mock('../../../../adapters/leasing-adapter/leases')

const mockGetByContactCode = jest.fn()
const mockGetByContactCodeBatch = jest.fn()

;(contactsAdapterModule.makeContactsAdapter as jest.Mock).mockReturnValue({
  getByContactCode: mockGetByContactCode,
  getByContactCodeBatch: mockGetByContactCodeBatch,
})

const app = new Koa()
const koaRouter = new KoaRouter()
const apiRouter = makeOkapiRouter(koaRouter, {
  openapi: { info: { title: 'test' } },
})
routes(apiRouter, { contactsService: { url: 'http://test' } } as Config)
app.use(koaRouter.routes())

const redactedContact = factory.contactsServiceContact.build({
  contactCode: 'P000999',
  protectedIdentity: true,
  personal: {
    nationalId: 'redacted',
    birthDate: 'redacted',
    firstName: 'redacted',
    lastName: 'redacted',
    fullName: 'redacted',
  },
})
const unredactedContact = factory.contactsServiceContact.build({
  contactCode: 'P000999',
  protectedIdentity: true,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetByContactCode.mockResolvedValue({ ok: true, data: redactedContact })
  mockGetByContactCodeBatch.mockResolvedValue({
    ok: true,
    data: [unredactedContact],
  })
})

describe('GET /v1/contacts/:contactCode — protected identity', () => {
  it('returns a protected tenant with a lease in Tenfast unredacted', async () => {
    ;(leasesAdapter.getLeasesByContactCode as jest.Mock).mockResolvedValue([
      factory.lease.build({ status: LeaseStatus.Current }),
    ])

    const res = await request(app.callback()).get('/v1/contacts/P000999')

    expect(res.status).toBe(200)
    expect(res.body.content.personal.nationalRegistrationNumber).toBe(
      '199001011234'
    )
    expect(mockGetByContactCodeBatch).toHaveBeenCalledWith(
      ['P000999'],
      expect.objectContaining({ verifiedTenants: true })
    )
  })

  it('keeps a protected identity without a lease in Tenfast redacted', async () => {
    ;(leasesAdapter.getLeasesByContactCode as jest.Mock).mockResolvedValue([])

    const res = await request(app.callback()).get('/v1/contacts/P000999')

    expect(res.status).toBe(200)
    expect(res.body.content.personal.nationalRegistrationNumber).toBe(
      'redacted'
    )
    expect(mockGetByContactCodeBatch).not.toHaveBeenCalled()
  })
})
