import { createLeasingApi } from '../src/api/client'

const bffUrl = 'http://bff.test/leasing-portal'
const coreUrl = 'http://core.test'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('createLeasingApi under concurrent 401s', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes once and retries every request', async () => {
    let refreshed = false
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: Request | string, init?: RequestInit) => {
        const req = input instanceof Request ? input : new Request(input, init)
        calls.push(`${req.method} ${req.url}`)
        if (req.url.endsWith('/auth/refresh')) {
          refreshed = true
          return json({ message: 'ok' })
        }
        return refreshed
          ? json({ id: 'user-1', source: 'keycloak' })
          : json({ message: 'Token expired' }, 401)
      })
    )

    const api = createLeasingApi({ bffUrl, coreUrl })
    const results = await Promise.all([
      api.GET('/auth/profile'),
      api.GET('/auth/profile'),
      api.GET('/auth/profile'),
    ])

    expect(results.map((r) => r.response.status)).toEqual([200, 200, 200])
    expect(calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1)
    expect(calls.filter((c) => c.endsWith('/auth/profile'))).toHaveLength(6)
  })

  it('forgets the request on network failure instead of keeping it forever', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )

    const api = createLeasingApi({ bffUrl, coreUrl })

    await expect(api.GET('/auth/profile')).rejects.toThrow('Failed to fetch')
  })
})
