import request from 'supertest'
import Koa from 'koa'

import { parseRequest } from '../../middleware/parse-request'
import bodyParser from 'koa-body'
import { z } from 'zod'

const app = new Koa()
app.use(bodyParser())
app.use(
  parseRequest({
    body: z.object({ foo: z.string() }),
    query: z.object({ bar: z.string() }),
  })
)

app.use((ctx) => {
  ctx.status = 200
})

describe(parseRequest, () => {
  it('responds with 400 when body is invalid', async () => {
    const response = await request(app.callback())
      .post('/api')
      .query({ bar: 'baz' })
      .send({ foo: { foo: 'bar' } })

    expect(response.status).toBe(400)
  })

  it('responds with 400 when query is invalid', async () => {
    const response = await request(app.callback())
      .get('/api')
      .query({ asdf: 123 })

    expect(response.status).toBe(400)
  })

  it('responds with 200 when body and query are valid', async () => {
    const response = await request(app.callback())
      .post('/api')
      .query({ bar: 'baz' })
      .send({ foo: 'bar' })

    expect(response.status).toBe(200)
  })
})
