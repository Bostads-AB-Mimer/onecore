import { createLeasingApi } from '../src/api/client'

const bffUrl = 'http://bff.test/leasing-portal'
const coreUrl = 'http://core.test'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Queues one response per call; records each request for assertions. */
const stubFetchSequence = (responses: Response[]) => {
  const calls: Request[] = []
  const fetchMock = vi.fn(
    async (input: Request | string, init?: RequestInit) => {
      calls.push(input instanceof Request ? input : new Request(input, init))
      const next = responses.shift()
      if (!next) throw new Error('fetch called more times than stubbed')
      return next
    }
  )
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

describe('createLeasingApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes the session via core on 401 and retries once', async () => {
    const calls = stubFetchSequence([
      json({ message: 'Token expired' }, 401),
      json({ message: 'Token refreshed successfully' }),
      json({ id: 'user-1', source: 'keycloak' }),
    ])

    const result = await createLeasingApi({ bffUrl, coreUrl }).GET(
      '/auth/profile'
    )

    expect(result.response.status).toBe(200)
    expect(result.data?.id).toBe('user-1')
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `GET ${bffUrl}/auth/profile`,
      `POST ${coreUrl}/auth/refresh`,
      `GET ${bffUrl}/auth/profile`,
    ])
    expect(calls[1].credentials).toBe('include')
  })

  it('passes the 401 through when the refresh fails', async () => {
    const calls = stubFetchSequence([
      json({ message: 'Token expired' }, 401),
      json({ error: 'Token refresh failed' }, 401),
    ])

    const result = await createLeasingApi({ bffUrl, coreUrl }).GET(
      '/auth/profile'
    )

    expect(result.response.status).toBe(401)
    expect(calls).toHaveLength(2)
  })

  it('does not touch core on a successful response', async () => {
    const calls = stubFetchSequence([
      json({ id: 'user-1', source: 'keycloak' }),
    ])

    await createLeasingApi({ bffUrl, coreUrl }).GET('/auth/profile')

    expect(calls).toHaveLength(1)
  })
})
