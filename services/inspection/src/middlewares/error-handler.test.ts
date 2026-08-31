import Koa from 'koa'
import request from 'supertest'
import errorHandler from './error-handler'

describe('errorHandler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => null)
  })

  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore()
  })

  const app = new Koa()
  app.use(errorHandler())

  it('catches errors and passes the error message along to the response', async () => {
    app.use(async () => {
      throw new Error('I should be caught')
    })
    app.use(async (ctx) => {
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
