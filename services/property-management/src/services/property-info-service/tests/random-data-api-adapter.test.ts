import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import axios from 'axios'
import { routes } from '../index'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

jest.mock('axios')
const mockedAxios = jest.mocked(axios, { shallow: true })

describe('randomDataApiAdapter', () => {
  describe('GET /search?freeTextQuery', () => {
    it('calls random data api', async () => {
      const query = '1337'
      mockedAxios.mockReturnValue(
        Promise.resolve('SUCCESS') as Promise<unknown>
      )

      await request(app.callback()).get(`/search?freeTextQuery=${query}`)

      expect(mockedAxios).toBeCalledWith(
        'https://random-data-api.com/api/v2/appliances'
      )
    })
  })
})
