import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

describe('lease-service', () => {
  describe('GET /my-lease', () => {
    it('responds', async () => {
      const res = await request(app.callback()).get('/my-lease')
      expect(res.status).toBe(200)
      expect(res.body.data.lease).toBeDefined()
    })
  })
})
