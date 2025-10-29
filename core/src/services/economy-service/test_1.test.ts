import Koa from 'koa'
import Router from '@koa/router'
import request from 'supertest'

import bodyParser from 'koa-bodyparser'

import { routes } from './test_1'
import * as getUserData from './get-user-data'

describe('test 1', () => {
  const app = new Koa()
  const router = new Router()

  app.use(bodyParser())
  routes(router)
  app.use(router.routes())

  it('stops bad input', async () => {
    const response = await request(app.callback())
      .get('/users/123')
      .send({ foo: 1 })

    expect(response.status).toBe(400)
  })

  it('allows good input', async () => {
    const response = await request(app.callback())
      .get('/users/123')
      .send({ foo: 'bar' })

    expect(response.status).toBe(200)
  })

  it('stops bad output', async () => {
    jest
      .spyOn(getUserData, 'getUserData')
      .mockReturnValueOnce({ name: 1 } as any)

    const response = await request(app.callback())
      .get('/users/123')
      .send({ foo: 'bar' })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Response validation failed' })
  })

  it('allows good output', async () => {
    jest.spyOn(getUserData, 'getUserData').mockReturnValueOnce({ name: 'foo' })

    const response = await request(app.callback())
      .get('/users/123')
      .send({ foo: 'bar' })

    expect(response.status).toBe(200)
    expect(response.body.content).toEqual({ name: 'foo' })
  })
})
