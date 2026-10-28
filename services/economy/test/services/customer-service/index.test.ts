import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as customerService from '@src/services/customer-service/service'
import { routes } from '@src/services/customer-service'
import * as factory from '@test/factories'

const app = new Koa()
const router = new KoaRouter()

app.use(bodyParser())
routes(router)
app.use(router.routes())

describe('POST /customers/:contactCode/sync', () => {
  it('responds with 200 on successful sync', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    jest
      .spyOn(customerService, 'syncCustomer')
      .mockResolvedValueOnce({ dbId: '12345' })

    const res = await request(app.callback())
      .post(`/customers/${payload.contactCode}/sync`)
      .send(payload)

    expect(res.status).toBe(200)
  })

  it('responds with 500 when sync fails', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    jest
      .spyOn(customerService, 'syncCustomer')
      .mockRejectedValueOnce(new Error('could-not-create-or-update-contact'))

    const res = await request(app.callback())
      .post(`/customers/${payload.contactCode}/sync`)
      .send(payload)

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Internal server error')
  })

  it('responds with 200 and skipped:true when contact does not exist and create not requested', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    jest.spyOn(customerService, 'syncCustomer').mockResolvedValueOnce(null)

    const res = await request(app.callback())
      .post(`/customers/${payload.contactCode}/sync`)
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe(true)
  })

  it('responds with 200 and skipped:false when contact is synced', async () => {
    const payload = factory.syncContactToEconomyPayload.build()

    jest
      .spyOn(customerService, 'syncCustomer')
      .mockResolvedValueOnce({ dbId: '12345' })

    const res = await request(app.callback())
      .post(`/customers/${payload.contactCode}/sync`)
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe(false)
  })

  it('responds with 400 when request body is invalid', async () => {
    const res = await request(app.callback())
      .post('/customers/P12345/sync')
      .send({ invalid: true })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request body')
  })

  it('passes correct field mapping to syncCustomer', async () => {
    const payload = factory.syncContactToEconomyPayload.build({
      contactCode: 'P99999',
      fullName: 'Testsson, Test',
      street: 'Testgatan 5',
      zipCode: '11111',
      city: 'Stockholm',
      emailAddress: 'test@test.se',
    })

    const spy = jest
      .spyOn(customerService, 'syncCustomer')
      .mockResolvedValueOnce(null)

    await request(app.callback())
      .post(`/customers/${payload.contactCode}/sync?create=true`)
      .send(payload)

    expect(spy).toHaveBeenCalledWith(
      {
        contactCode: 'P99999',
        fullName: 'Testsson, Test',
        address: {
          street: 'Testgatan 5',
          postalCode: '11111',
          city: 'Stockholm',
        },
        emailAddress: 'test@test.se',
      },
      true
    )
  })
})
