import Koa from 'koa'
import request from 'supertest'
import errorHandler from '@/middlewares/error-handler'

describe('errorHandler', () => {
  let app: Koa<Koa.DefaultState, Koa.DefaultContext>
  let errSpy: jest.SpyInstance

  beforeAll(() => {
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    errSpy.mockRestore()
  })

  beforeEach(() => {
    app = new Koa()
    app.use(errorHandler())
  })

  it('catches errors and passes the error message along to the response', async () => {
    app.use(async (ctx, next) => {
      throw new Error('I should be caught')
    })
    app.use(async (ctx, next) => {
      ctx.status = 200
      ctx.body = 'All is good'
    })
    const response = await request(app.callback()).get('/')
    expect(response.status).toBe(500)
    expect(response.body).toStrictEqual({
      errorMessage: 'I should be caught',
      message: 'Internal server error',
    })
  })
})
