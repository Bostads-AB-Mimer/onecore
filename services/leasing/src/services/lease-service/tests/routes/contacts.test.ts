import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { leasing, WaitingListType } from '@onecore/types'

import { routes } from '../../routes/contacts'
import * as tenantLeaseAdapter from '../../adapters/xpand/tenant-lease-adapter'
import * as xPandSoapAdapter from '../../adapters/xpand/xpand-soap-adapter'
import * as applicationProfileAdapter from '../../adapters/application-profile-adapter'
import * as applicationProfileService from '../../create-or-update-application-profile'
import * as factories from '../../tests/factories'
import * as tenants from '../../get-tenant'
import * as factory from '../factories'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

jest.mock('axios')

beforeEach(jest.resetAllMocks)
describe('GET /contacts/search', () => {
  it('responds with 400 if query param is missing', async () => {
    const res = await request(app.callback()).get('/contacts/search')
    expect(res.status).toBe(400)
  })

  it('responds with 500 if error', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsDataBySearchQuery')
      .mockResolvedValueOnce({ ok: false, err: 'internal-error' })

    const res = await request(app.callback()).get('/contacts/search?q=foo')
    expect(res.status).toBe(500)
  })

  it('returns a list of contact data', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsDataBySearchQuery')
      .mockResolvedValueOnce({
        ok: true,
        data: [
          {
            contactCode: 'foo',
            fullName: 'Foo Bar',
            nationalRegistrationNumber: '123456789',
          },
        ],
      })

    const res = await request(app.callback()).get('/contacts/search?q=foo')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      content: expect.arrayContaining([
        expect.objectContaining({
          contactCode: 'foo',
          fullName: 'Foo Bar',
          nationalRegistrationNumber: '123456789',
        }),
      ]),
    })
  })

  describe('POST /contacts/:nationalRegistrationNumber/waitingLists/reset', () => {
    it('responds with 200 and a message upon success', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({ ok: true, data: undefined })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockResolvedValue({ ok: true, data: undefined })

      const res = await request(app.callback())
        .post('/contacts/1234567890/waitingLists/reset')
        .send({
          contactCode: '123',
          waitingListType: WaitingListType.ParkingSpace,
        })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        content: {
          message: 'Waiting List time successfullt reset for applicant',
        },
      })
    })

    it('returns status 200 upon not-in-waiting-list error from removeApplicantFromWaitingList', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({ ok: false, err: 'not-in-waiting-list' })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockResolvedValue({ ok: true, data: undefined })

      const res = await request(app.callback())
        .post('/contacts/1234567890/waitingLists/reset')
        .send({
          contactCode: '123',
          waitingListType: WaitingListType.ParkingSpace,
        })

      expect(res.status).toBe(200)
    })

    it('returns status 404 upon waiting-list-type-not-implemented error from removeApplicantFromWaitingList', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({
          ok: false,
          err: 'waiting-list-type-not-implemented',
        })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockResolvedValue({
          ok: false,
          err: 'waiting-list-type-not-implemented',
        })

      const res = await request(app.callback())
        .post('/contacts/1234567890/waitingLists/reset')
        .send({
          contactCode: '123',
          waitingListType: WaitingListType.ParkingSpace,
        })

      expect(res.status).toBe(404)
      expect(res.body).toEqual({
        error: 'Waiting List Type not Implemented',
      })
    })

    it('returns status 500 upon unknown error from removeApplicantFromWaitingList', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({ ok: false, err: 'unknown' })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockResolvedValue({ ok: true, data: undefined })

      const res = await request(app.callback())
        .post('/contacts/1234567890/waitingLists/reset')
        .send({
          contactCode: '123',
          waitingListType: WaitingListType.ParkingSpace,
        })

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: 'Unknown error',
      })
    })

    it('returns status 500 upon unknown error from addApplicantToToWaitingList', async () => {
      jest
        .spyOn(xPandSoapAdapter, 'removeApplicantFromWaitingList')
        .mockResolvedValue({ ok: true, data: undefined })
      jest
        .spyOn(xPandSoapAdapter, 'addApplicantToToWaitingList')
        .mockImplementation(() => {
          throw new Error('Noooo fel')
        })

      const res = await request(app.callback())
        .post('/contacts/1234567890/waitingLists/reset')
        .send({
          contactCode: '123',
          waitingListType: WaitingListType.ParkingSpace,
        })

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: 'Noooo fel',
      })
    })
  })
})

describe('GET /contacts/for-identity-check', () => {
  it('returns paginated contacts for identity check', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsForIdentityCheck')
      .mockResolvedValueOnce({
        content: [
          {
            contactCode: 'P12345',
            nationalRegistrationNumber: '198501011234',
          },
          {
            contactCode: 'P67890',
            nationalRegistrationNumber: '197012315678',
          },
        ],
        _meta: {
          totalRecords: 2,
          page: 1,
          limit: 20,
          count: 2,
        },
        _links: [
          {
            href: '/contacts/for-identity-check?page=1&limit=20',
            rel: 'self',
          },
        ],
      })

    const res = await request(app.callback()).get(
      '/contacts/for-identity-check'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toHaveLength(2)
    expect(res.body.content[0]).toEqual({
      contactCode: 'P12345',
      nationalRegistrationNumber: '198501011234',
    })
    expect(res.body._meta.totalRecords).toBe(2)
  })

  it('responds with 500 on error', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsForIdentityCheck')
      .mockRejectedValueOnce(new Error('Database error'))

    const res = await request(app.callback()).get(
      '/contacts/for-identity-check'
    )

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Internal server error')
  })

  it('supports pagination parameters', async () => {
    jest
      .spyOn(tenantLeaseAdapter, 'getContactsForIdentityCheck')
      .mockResolvedValueOnce({
        content: [
          {
            contactCode: 'P12345',
            nationalRegistrationNumber: '198501011234',
          },
        ],
        _meta: {
          totalRecords: 100,
          page: 5,
          limit: 10,
          count: 1,
        },
        _links: [],
      })

    const res = await request(app.callback()).get(
      '/contacts/for-identity-check?page=5&limit=10'
    )

    expect(res.status).toBe(200)
    expect(res.body._meta.page).toBe(5)
    expect(res.body._meta.limit).toBe(10)
  })
})

describe('GET /contacts/:contactCode/application-profile', () => {
  it('responds with 404 if not found', async () => {
    jest
      .spyOn(applicationProfileAdapter, 'getByContactCode')
      .mockResolvedValueOnce({ ok: false, err: 'not-found' })

    const res = await request(app.callback()).get(
      '/contacts/1234/application-profile'
    )

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      error: 'not-found',
    })
  })

  it('responds with 200 and application profile', async () => {
    jest
      .spyOn(applicationProfileAdapter, 'getByContactCode')
      .mockResolvedValueOnce({
        ok: true,
        data: factories.applicationProfile.build(),
      })

    const res = await request(app.callback()).get(
      '/contacts/1234/application-profile'
    )

    expect(res.status).toBe(200)
    expect(() =>
      leasing.v1.GetApplicationProfileResponseDataSchema.parse(res.body.content)
    ).not.toThrow()
  })
})

describe('POST /contacts/:contactCode/application-profile', () => {
  it('responds with 400 if bad params', async () => {
    const res = await request(app.callback())
      .post('/contacts/1234/application-profile')
      .send({ foo: 'bar' })

    expect(res.status).toBe(400)
  })

  it('updates application profile', async () => {
    jest
      .spyOn(applicationProfileService, 'createOrUpdateApplicationProfile')
      .mockResolvedValueOnce({
        ok: true,
        data: ['updated', factories.applicationProfile.build()],
      })

    const res = await request(app.callback())
      .post('/contacts/1234/application-profile')
      .send({
        expiresAt: null,
        numAdults: 0,
        numChildren: 0,
        housingType: 'RENTAL',
        housingTypeDescription: null,
        landlord: null,
        housingReference: factories.applicationProfileHousingReference.build(),
        lastUpdatedAt: new Date(),
      })

    expect(res.status).toBe(200)
    expect(() =>
      leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema.parse(
        res.body.content
      )
    ).not.toThrow()
  })

  it('creates if non-existent', async () => {
    jest
      .spyOn(applicationProfileService, 'createOrUpdateApplicationProfile')
      .mockResolvedValueOnce({
        ok: true,
        data: ['created', factories.applicationProfile.build()],
      })

    const res = await request(app.callback())
      .post('/contacts/1234/application-profile')
      .send({
        expiresAt: null,
        numAdults: 0,
        numChildren: 0,
        housingType: 'RENTAL',
        housingTypeDescription: null,
        landlord: null,
        housingReference: factories.applicationProfileHousingReference.build(),
        lastUpdatedAt: new Date(),
      })

    expect(res.status).toBe(201)
    expect(() =>
      leasing.v1.CreateOrUpdateApplicationProfileResponseDataSchema.parse(
        res.body.content
      )
    ).not.toThrow()
  })
})

describe('GET /contacts/:contactCode/tenant', () => {
  it('responds with 200 and a tenant', async () => {
    const tenant = factory.tenant.build()

    jest.spyOn(tenants, 'getTenant').mockResolvedValueOnce({
      ok: true,
      data: tenant,
    })

    const res = await request(app.callback()).get('/contacts/1231234/tenant')
    //Testa mot zod-schemat
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body.content)).toEqual(JSON.stringify(tenant))
  })

  it("responds with 500 and an error with the correct info when tenant doesn't have a valid housing contract", async () => {
    jest.spyOn(tenants, 'getTenant').mockResolvedValueOnce({
      ok: false,
      err: 'no-valid-housing-contract',
    })

    const res = await request(app.callback()).get('/contacts/1231234/tenant')

    expect(res.status).toBe(500)
    expect(res.body.type).toEqual('no-valid-housing-contract')
    expect(res.body.title).toEqual('No valid housing contract found')
    expect(res.body.status).toEqual(500)
    expect(res.body.detail).toEqual('No active or upcoming contract found.')
  })
})
