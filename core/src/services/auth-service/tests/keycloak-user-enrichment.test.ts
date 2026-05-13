import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../../common/config'

const { url, realm } = config.auth.keycloak
const tokenUrl = `${url}/realms/${realm}/protocol/openid-connect/token`
const userUrl = (id: string) =>
  `${url}/admin/realms/${realm}/users/${encodeURIComponent(id)}`

const mockServer = setupServer()

function tokenHandler(token = 'test-token', expiresIn = 300) {
  return http.post(tokenUrl, () =>
    HttpResponse.json({ access_token: token, expires_in: expiresIn })
  )
}

const enabledUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  username: 'alice',
  firstName: 'Alice',
  lastName: 'Andersson',
  enabled: true,
  attributes: { phone: ['070-1234567'], signature: ['AA'] },
  ...overrides,
})

describe('keycloak-user-enrichment', () => {
  let enrichKeycloakUsers: typeof import('../keycloak-user-enrichment').enrichKeycloakUsers

  beforeAll(() => {
    mockServer.listen()
  })

  beforeEach(() => {
    jest.resetModules()
    jest.doMock('@onecore/utilities', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ax = require('axios')
      return {
        logger: {
          info: () => undefined,
          error: () => undefined,
          debug: () => undefined,
        },
        loggedAxios: ax.default ?? ax,
        axiosTypes: ax.default ?? ax,
        generateRouteMetadata: jest.fn(),
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    enrichKeycloakUsers =
      require('../keycloak-user-enrichment').enrichKeycloakUsers
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  it('returns empty map for empty input and makes no HTTP calls', async () => {
    let called = false
    mockServer.use(
      http.post(tokenUrl, () => {
        called = true
        return HttpResponse.json({ access_token: 't', expires_in: 300 })
      })
    )

    const result = await enrichKeycloakUsers([])

    expect(result.size).toBe(0)
    expect(called).toBe(false)
  })

  it('filters out null, undefined, and empty strings', async () => {
    let called = false
    mockServer.use(
      http.post(tokenUrl, () => {
        called = true
        return HttpResponse.json({ access_token: 't', expires_in: 300 })
      })
    )

    const result = await enrichKeycloakUsers([null, undefined, ''])

    expect(result.size).toBe(0)
    expect(called).toBe(false)
  })

  it('enriches a single user from custom attributes', async () => {
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('u1'), () => HttpResponse.json(enabledUser()))
    )

    const result = await enrichKeycloakUsers(['u1'])

    expect(result.get('u1')).toEqual({
      id: 'u1',
      name: 'Alice Andersson',
      phone: '070-1234567',
      signature: 'AA',
    })
  })

  it('falls back to username when first/last name are missing', async () => {
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('u1'), () =>
        HttpResponse.json(
          enabledUser({ firstName: undefined, lastName: undefined })
        )
      )
    )

    const result = await enrichKeycloakUsers(['u1'])

    expect(result.get('u1')?.name).toBe('alice')
  })

  it('returns null phone/signature when attributes are missing', async () => {
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('u1'), () =>
        HttpResponse.json(enabledUser({ attributes: undefined }))
      )
    )

    const result = await enrichKeycloakUsers(['u1'])

    expect(result.get('u1')?.phone).toBeNull()
    expect(result.get('u1')?.signature).toBeNull()
  })

  it('deduplicates ids and fetches each unique id once', async () => {
    let callCount = 0
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('u1'), () => {
        callCount++
        return HttpResponse.json(enabledUser())
      })
    )

    const result = await enrichKeycloakUsers(['u1', 'u1', 'u1'])

    expect(callCount).toBe(1)
    expect(result.size).toBe(1)
    expect(result.get('u1')).not.toBeNull()
  })

  it('returns null for 404 (missing user) without failing the batch', async () => {
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('u1'), () => HttpResponse.json(enabledUser())),
      http.get(
        userUrl('missing'),
        () => new HttpResponse(null, { status: 404 })
      )
    )

    const result = await enrichKeycloakUsers(['u1', 'missing'])

    expect(result.get('u1')).not.toBeNull()
    expect(result.get('missing')).toBeNull()
  })

  it('returns null for deactivated users (enabled: false)', async () => {
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('u1'), () =>
        HttpResponse.json(enabledUser({ enabled: false }))
      )
    )

    const result = await enrichKeycloakUsers(['u1'])

    expect(result.get('u1')).toBeNull()
  })

  it('returns null for transient 5xx errors without failing the batch', async () => {
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('u1'), () => HttpResponse.json(enabledUser())),
      http.get(userUrl('boom'), () => new HttpResponse(null, { status: 500 }))
    )

    const result = await enrichKeycloakUsers(['u1', 'boom'])

    expect(result.get('u1')).not.toBeNull()
    expect(result.get('boom')).toBeNull()
  })

  it('clears the admin-token cache and retries once on 401', async () => {
    let tokenCallCount = 0
    let userCallCount = 0
    mockServer.use(
      http.post(tokenUrl, () => {
        tokenCallCount++
        return HttpResponse.json({
          access_token: `token-${tokenCallCount}`,
          expires_in: 300,
        })
      }),
      http.get(userUrl('u1'), () => {
        userCallCount++
        if (userCallCount === 1) return new HttpResponse(null, { status: 401 })
        return HttpResponse.json(enabledUser())
      })
    )

    const result = await enrichKeycloakUsers(['u1'])

    expect(tokenCallCount).toBe(2)
    expect(userCallCount).toBe(2)
    expect(result.get('u1')).not.toBeNull()
  })

  it('uses the TTL cache on a second call within 60s (no HTTP refetch)', async () => {
    let userCallCount = 0
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('u1'), () => {
        userCallCount++
        return HttpResponse.json(enabledUser())
      })
    )

    await enrichKeycloakUsers(['u1'])
    await enrichKeycloakUsers(['u1'])

    expect(userCallCount).toBe(1)
  })

  it('caches null results so a missing id is not refetched within TTL', async () => {
    let userCallCount = 0
    mockServer.use(
      tokenHandler(),
      http.get(userUrl('missing'), () => {
        userCallCount++
        return new HttpResponse(null, { status: 404 })
      })
    )

    await enrichKeycloakUsers(['missing'])
    await enrichKeycloakUsers(['missing'])

    expect(userCallCount).toBe(1)
  })

  it('returns null for every requested id when the admin token cannot be obtained', async () => {
    mockServer.use(http.post(tokenUrl, () => HttpResponse.error()))

    const result = await enrichKeycloakUsers(['u1', 'u2'])

    expect(result.get('u1')).toBeNull()
    expect(result.get('u2')).toBeNull()
  })
})
