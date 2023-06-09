import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as tenantLeaseAdapter from '../adapters/tenant-lease-adapter'
import leaseMock from './leaseMock'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('lease-service', () => {
  describe('GET /leases', () => {
    it('responds with an array of leases', async () => {
      const getLeasesSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLeases')
        .mockResolvedValue([leaseMock])

      const res = await request(app.callback()).get('/leases')
      expect(res.status).toBe(200)
      expect(res.body.data).toBeInstanceOf(Array)
      expect(getLeasesSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.data[0])).toEqual(
        JSON.stringify(leaseMock)
      )
    })
  })

  describe('GET /leases/:id', () => {
    it('responds with a lease', async () => {
      const getLeaseSpy = jest
        .spyOn(tenantLeaseAdapter, 'getLease')
        .mockResolvedValue(leaseMock)

      const res = await request(app.callback()).get('/leases/1337')
      expect(res.status).toBe(200)
      expect(getLeaseSpy).toHaveBeenCalled()
      expect(JSON.stringify(res.body.data)).toEqual(JSON.stringify(leaseMock))
    })
  })
})
