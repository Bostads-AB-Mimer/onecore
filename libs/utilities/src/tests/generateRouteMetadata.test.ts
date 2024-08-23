import { generateRouteMetadata } from '../routes/generateRouteMetadata'
import { Context as KoaContext } from 'koa'

describe('generateRouteMetadata', () => {
  let ctx: KoaContext

  beforeEach(() => {
    ctx = {
      protocol: 'http',
      host: 'localhost:3000',
      path: '/api/resource',
      params: {},
      query: {},
      href: 'http://localhost:3000/api/resource',
    } as unknown as KoaContext
  })

  it('should generate metadata without query parameters', () => {
    const metadata = generateRouteMetadata(ctx)
    expect(metadata).toEqual({
      _links: {
        self: {
          href: 'http://localhost:3000/api/resource',
        },
        link: {
          href: 'http://localhost:3000/api/resource',
          templated: false,
        },
      },
    })
  })

  it('should generate metadata with query parameters', () => {
    const queryParams = ['a', 'b']
    const metadata = generateRouteMetadata(ctx, queryParams)
    expect(metadata).toEqual({
      _links: {
        self: {
          href: 'http://localhost:3000/api/resource',
        },
        link: {
          href: 'http://localhost:3000/api/resource?a={a}&b={b}',
          templated: true,
        },
      },
    })
  })

  it('should generate metadata with path parameters', () => {
    ctx.params = { id: '123' }
    ctx.path = '/api/resource/123'
    ctx.href = 'http://localhost:3000/api/resource/123'
    const metadata = generateRouteMetadata(ctx)
    expect(metadata).toEqual({
      _links: {
        self: {
          href: 'http://localhost:3000/api/resource/123',
        },
        link: {
          href: 'http://localhost:3000/api/resource/{id}',
          templated: true,
        },
      },
    })
  })

  it('should generate metadata with both path and query parameters', () => {
    ctx.params = { id: '123' }
    ctx.path = '/api/resource/123'
    ctx.href = 'http://localhost:3000/api/resource/123'
    const queryParams = ['a', 'b']
    const metadata = generateRouteMetadata(ctx, queryParams)
    expect(metadata).toEqual({
      _links: {
        self: {
          href: 'http://localhost:3000/api/resource/123',
        },
        link: {
          href: 'http://localhost:3000/api/resource/{id}?a={a}&b={b}',
          templated: true,
        },
      },
    })
  })
})
