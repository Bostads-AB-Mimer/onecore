import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { makeOkapiRouter } from 'koa-okapi-router'

import { routes } from '../index'
import * as contactsAdapterModule from '../../../../adapters/contacts-adapter'
import { Config } from '@/common/config'
import type { Contact } from '@onecore/contacts/domain'

jest.mock('../../../../adapters/contacts-adapter')

const mockGetByContactCodes = jest.fn()

;(contactsAdapterModule.makeContactsAdapter as jest.Mock).mockReturnValue({
  listContacts: jest.fn(),
  getByContactCodes: mockGetByContactCodes,
  getByContactCode: jest.fn(),
  getByTrusteeOfContactCode: jest.fn(),
  getByNationalId: jest.fn(),
  listByPhoneNumber: jest.fn(),
  syncContacts: jest.fn(),
})

const app = new Koa()
const koaRouter = new KoaRouter()
const apiRouter = makeOkapiRouter(koaRouter, {
  openapi: { info: { title: 'test' } },
})

const config = { contactsService: { url: 'http://test' } }
routes(apiRouter, config as Config)

app.use(koaRouter.routes())

beforeEach(jest.clearAllMocks)

const makeIndividualContact = (code: string): Contact => ({
  type: 'individual',
  contactCode: code,
  contactKey: 'KEY',
  personal: {
    nationalId: '199001011234',
    birthDate: '1990-01-01',
    firstName: 'Test',
    lastName: 'Testsson',
    fullName: 'Test Testsson',
  },
  communication: {
    phoneNumbers: [
      { phoneNumber: '0701234567', type: 'mobile', isPrimary: true },
    ],
    emailAddresses: [
      { emailAddress: 'test@example.com', type: 'private', isPrimary: true },
    ],
    specialAttention: false,
  },
  addresses: [
    {
      street: 'Testgatan 1',
      zipCode: '72345',
      city: 'Västerås',
      region: null,
      country: 'SE',
      full: 'Testgatan 1, 72345 Västerås',
    },
  ],
})

describe('GET /v1/contacts/by-codes', () => {
  it('returns 400 when codes parameter is missing', async () => {
    const res = await request(app.callback()).get('/v1/contacts/by-codes')
    expect(res.status).toBe(400)
  })

  it('returns 400 when codes parameter is empty', async () => {
    const res = await request(app.callback()).get(
      '/v1/contacts/by-codes?codes='
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when codes contains only whitespace/commas', async () => {
    const res = await request(app.callback()).get(
      '/v1/contacts/by-codes?codes=,,,  ,'
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 with contacts for valid codes', async () => {
    const contacts: Contact[] = [
      makeIndividualContact('P100001'),
      makeIndividualContact('P100002'),
    ]
    mockGetByContactCodes.mockResolvedValueOnce({ ok: true, data: contacts })

    const res = await request(app.callback()).get(
      '/v1/contacts/by-codes?codes=P100001,P100002'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
    expect(res.body.content[0].contactCode).toBe('P100001')
    expect(res.body.content[1].contactCode).toBe('P100002')
    expect(mockGetByContactCodes).toHaveBeenCalledWith(['P100001', 'P100002'])
  })

  it('trims whitespace from codes', async () => {
    mockGetByContactCodes.mockResolvedValueOnce({ ok: true, data: [] })

    await request(app.callback()).get(
      '/v1/contacts/by-codes?codes= P100001 , P100002 '
    )

    expect(mockGetByContactCodes).toHaveBeenCalledWith(['P100001', 'P100002'])
  })

  it('returns transformed contact shape', async () => {
    const contact = makeIndividualContact('P100001')
    mockGetByContactCodes.mockResolvedValueOnce({
      ok: true,
      data: [contact],
    })

    const res = await request(app.callback()).get(
      '/v1/contacts/by-codes?codes=P100001'
    )

    expect(res.status).toBe(200)
    const c = res.body.content[0]
    expect(c).toMatchObject({
      type: 'individual',
      contactCode: 'P100001',
      personal: {
        nationalRegistrationNumber: '199001011234',
        fullName: 'Test Testsson',
      },
      communication: {
        phoneNumbers: [{ phoneNumber: '0701234567' }],
        emailAddresses: [{ emailAddress: 'test@example.com' }],
      },
    })
  })

  it('returns 500 when adapter fails', async () => {
    mockGetByContactCodes.mockResolvedValueOnce({
      ok: false,
      err: 'unknown',
      statusCode: 500,
    })

    const res = await request(app.callback()).get(
      '/v1/contacts/by-codes?codes=P100001'
    )

    expect(res.status).toBe(500)
  })
})
