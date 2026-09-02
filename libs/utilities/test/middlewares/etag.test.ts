import http from 'http'
import type { AddressInfo } from 'net'
import Koa, { Context } from 'koa'

import { etagMiddleware } from '../../src/middlewares/etag'

type FakeCtx = {
  method: string
  status: number
  body: unknown
  headers: Record<string, string>
  requestHeaders: Record<string, string>
  response: { get(name: string): string }
  set(name: string, value: string): void
  get(name: string): string
}

const makeCtx = (requestHeaders: Record<string, string> = {}): FakeCtx => {
  const ctx: FakeCtx = {
    method: 'GET',
    status: 200,
    body: null,
    headers: {},
    requestHeaders,
    // Koa reads response headers via ctx.response.get, request via ctx.get.
    response: { get: (name) => ctx.headers[name.toLowerCase()] ?? '' },
    set(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    get(name) {
      return this.requestHeaders[name.toLowerCase()] ?? ''
    },
  }
  return ctx
}

const middleware = etagMiddleware()
const run = (ctx: FakeCtx, body: unknown, status = 200) =>
  middleware(ctx as unknown as Context, async () => {
    ctx.status = status
    ctx.body = body
  })

describe('etagMiddleware', () => {
  it('sets an ETag and pre-serializes the JSON body', async () => {
    const ctx = makeCtx()
    await run(ctx, { a: 1 })

    // Weak on purpose: the same tag identifies the identity and gzip
    // encodings, which a strong validator must not claim.
    expect(ctx.headers.etag).toMatch(/^W\/"[0-9a-f]{32}"$/)
    expect(ctx.body).toBe(JSON.stringify({ a: 1 }))
    expect(ctx.status).toBe(200)
  })

  it('answers a matching If-None-Match with an empty 304', async () => {
    const first = makeCtx()
    await run(first, { a: 1 })

    const second = makeCtx({ 'if-none-match': first.headers.etag })
    await run(second, { a: 1 })

    expect(second.status).toBe(304)
    expect(second.body).toBeNull()
  })

  it('matches strong-spelled validators and entries in a list', async () => {
    const first = makeCtx()
    await run(first, { a: 1 })

    // A proxy may strip the W/ prefix; the bare tag must still revalidate.
    const strongSpelled = first.headers.etag.replace(/^W\//, '')
    const second = makeCtx({
      'if-none-match': `"something-else", ${strongSpelled}`,
    })
    await run(second, { a: 1 })

    expect(second.status).toBe(304)
  })

  it('treats If-None-Match: * as matching any representation', async () => {
    const ctx = makeCtx({ 'if-none-match': '*' })
    await run(ctx, { a: 1 })

    expect(ctx.status).toBe(304)
    expect(ctx.body).toBeNull()
  })

  it('answers a full 200 when the body changed', async () => {
    const first = makeCtx()
    await run(first, { a: 1 })

    const second = makeCtx({ 'if-none-match': first.headers.etag })
    await run(second, { a: 2 })

    expect(second.status).toBe(200)
    expect(second.body).toBe(JSON.stringify({ a: 2 }))
  })

  it('marks tagged responses private, on 304s too', async () => {
    const first = makeCtx()
    await run(first, { a: 1 })
    expect(first.headers['cache-control']).toBe('private')

    const second = makeCtx({ 'if-none-match': first.headers.etag })
    await run(second, { a: 1 })
    expect(second.status).toBe(304)
    expect(second.headers['cache-control']).toBe('private')
  })

  it('keeps a Cache-Control the route already set', async () => {
    const ctx = makeCtx()
    await middleware(ctx as unknown as Context, async () => {
      ctx.status = 200
      ctx.body = { a: 1 }
      ctx.set('Cache-Control', 'no-store')
    })

    expect(ctx.headers['cache-control']).toBe('no-store')
    expect(ctx.headers.etag).toBeDefined()
  })

  it('leaves responses to unsafe methods untouched, even with a validator', async () => {
    const first = makeCtx()
    await run(first, { a: 1 })

    // A mutation must never be short-circuited into a 304 after it ran.
    const post = makeCtx({ 'if-none-match': first.headers.etag })
    post.method = 'POST'
    await run(post, { a: 1 })

    expect(post.status).toBe(200)
    expect(post.body).toEqual({ a: 1 })
    expect(post.headers.etag).toBeUndefined()
    expect(post.headers['cache-control']).toBeUndefined()
  })

  it('leaves buffers, strings and non-200 responses untouched', async () => {
    const buffer = makeCtx()
    await run(buffer, Buffer.from('binary'))
    expect(buffer.headers.etag).toBeUndefined()
    expect(buffer.body).toEqual(Buffer.from('binary'))

    const text = makeCtx()
    await run(text, 'plain text')
    expect(text.headers.etag).toBeUndefined()

    const error = makeCtx()
    await run(error, { reason: 'nope' }, 404)
    expect(error.headers.etag).toBeUndefined()
  })
})

// What the fake ctx cannot prove: Content-Type surviving the pre-serialized
// string body, and Koa stripping the body on 304.
describe('etagMiddleware over a real Koa app', () => {
  const payload = { hello: 'world', padding: 'x'.repeat(2048) }
  let server: http.Server
  let url: string

  beforeAll((done) => {
    const app = new Koa()
    app.use(etagMiddleware())
    app.use((ctx) => {
      ctx.status = 200
      ctx.body = payload
    })
    server = http.createServer(app.callback()).listen(0, () => {
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
      done()
    })
  })

  afterAll((done) => {
    server.close(done)
  })

  it('serves tagged JSON and 304s the revalidation round trip', async () => {
    const first = await fetch(url)
    expect(first.status).toBe(200)
    expect(first.headers.get('content-type')).toContain('application/json')
    expect(first.headers.get('etag')).toMatch(/^W\/"[0-9a-f]{32}"$/)
    expect(first.headers.get('cache-control')).toBe('private')
    await expect(first.json()).resolves.toEqual(payload)

    const etag = first.headers.get('etag') as string
    const second = await fetch(url, { headers: { 'If-None-Match': etag } })
    expect(second.status).toBe(304)
    expect(await second.text()).toBe('')
    expect(second.headers.get('cache-control')).toBe('private')
  })
})
