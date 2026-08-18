import { Context } from 'koa'

import { etagMiddleware } from '../../src/middlewares/etag'

type FakeCtx = {
  status: number
  body: unknown
  headers: Record<string, string>
  requestHeaders: Record<string, string>
  set(name: string, value: string): void
  get(name: string): string
}

const makeCtx = (requestHeaders: Record<string, string> = {}): FakeCtx => ({
  status: 200,
  body: null,
  headers: {},
  requestHeaders,
  set(name, value) {
    this.headers[name.toLowerCase()] = value
  },
  get(name) {
    return this.requestHeaders[name.toLowerCase()] ?? ''
  },
})

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

    expect(ctx.headers.etag).toMatch(/^"[0-9a-f]{32}"$/)
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

  it('matches weak validators and entries in a list', async () => {
    const first = makeCtx()
    await run(first, { a: 1 })

    const second = makeCtx({
      'if-none-match': `"something-else", W/${first.headers.etag}`,
    })
    await run(second, { a: 1 })

    expect(second.status).toBe(304)
  })

  it('answers a full 200 when the body changed', async () => {
    const first = makeCtx()
    await run(first, { a: 1 })

    const second = makeCtx({ 'if-none-match': first.headers.etag })
    await run(second, { a: 2 })

    expect(second.status).toBe(200)
    expect(second.body).toBe(JSON.stringify({ a: 2 }))
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
