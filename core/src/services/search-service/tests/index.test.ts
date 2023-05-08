import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { routes } from '../index'
import * as randomDataApiAdapter from '../adapters/random-data-api-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

jest.mock('../adapters/random-data-api-adapter')
const mockedRandomDataApiAdapter = jest.mocked(randomDataApiAdapter)
mockedRandomDataApiAdapter.getRandomData = jest.fn().mockResolvedValue({
  foo: 'bar',
})

describe('searchService', () => {
  describe('GET /search?freeTextQuery', () => {
    it('responds', async () => {
      const res = await request(app.callback()).get(
        '/search?freeTextQuery=searchQuery'
      )
      console.log(res.body)
      expect(res.status).toBe(200)
      expect(res.body).toStrictEqual({
        results: {
          foo: 'bar',
        },
        freeTextQuery: 'searchQuery',
      })
    })

    it('requires a free text query parameter', async () => {
      const res = await request(app.callback()).get('/search')
      expect(res.status).toBe(400)
      expect(res.body.errorMessage).toBe('Missing parameter: freeTextQuery')
    })

    it('calls random-data-adapter', async () => {
      const res = await request(app.callback()).get(
        '/search?freeTextQuery=searchQuery'
      )

      expect(mockedRandomDataApiAdapter.getRandomData).toBeCalled()
    })
  })
})
