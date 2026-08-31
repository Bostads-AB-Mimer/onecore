import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as xledgerAdapter from '@src/services/common/adapters/xledger-adapter'
import { routes } from '@src/services/contact-service'
import * as factory from '@test/factories'

const app = new Koa()
const router = new KoaRouter()

app.use(bodyParser())
routes(router)
app.use(router.routes())

describe('POST /contacts/:contactCode/sync', () => {
  it('responds with 200 on successful sync', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    jest.spyOn(xledgerAdapter, 'syncContact').mockResolvedValueOnce({
      ok: true,
      data: { dbId: '12345' },
    })

    const res = await request(app.callback())
      .post(`/contacts/${payload.contactCode}/sync`)
      .send(payload)

    expect(res.status).toBe(200)
  })

  it('responds with 500 when xledger sync fails', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    jest.spyOn(xledgerAdapter, 'syncContact').mockResolvedValueOnce({
      ok: false,
      err: 'could-not-update-contact',
    })

    const res = await request(app.callback())
      .post(`/contacts/${payload.contactCode}/sync`)
      .send(payload)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to sync contact to Xledger')
  })

  it('responds with 200 and skipped:true when contact does not exist in Xledger', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    jest.spyOn(xledgerAdapter, 'syncContact').mockResolvedValueOnce({
      ok: true,
      data: null,
    })

    const res = await request(app.callback())
      .post(`/contacts/${payload.contactCode}/sync`)
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe(true)
  })

  it('responds with 200 and skipped:false when contact is updated', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    jest.spyOn(xledgerAdapter, 'syncContact').mockResolvedValueOnce({
      ok: true,
      data: { dbId: '12345' },
    })

    const res = await request(app.callback())
      .post(`/contacts/${payload.contactCode}/sync`)
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe(false)
  })

  it('responds with 400 when request body is invalid', async () => {
    const res = await request(app.callback())
      .post('/contacts/P12345/sync')
      .send({ invalid: true })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request body')
  })

  it('passes correct field mapping to syncContact', async () => {
    const payload = factory.syncContactToEconomyPayload.build({
      contactCode: 'P99999',
      fullName: 'Testsson, Test',
      street: 'Testgatan 5',
      zipCode: '11111',
      city: 'Stockholm',
      emailAddress: 'test@test.se',
    })

    const spy = jest
      .spyOn(xledgerAdapter, 'syncContact')
      .mockResolvedValueOnce({
        ok: true,
        data: null,
      })

    await request(app.callback())
      .post(`/contacts/${payload.contactCode}/sync`)
      .send(payload)

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        ContactCode: 'P99999',
        FullName: 'Testsson, Test',
        StreetAddress: 'Testgatan 5',
        Street: 'Testgatan 5',
        PostalCode: '11111',
        City: 'Stockholm',
        Email: 'test@test.se',
      })
    )
  })
})
