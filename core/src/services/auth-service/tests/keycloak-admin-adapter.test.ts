import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../../common/config'

const { url, realm } = config.auth.keycloak
const tokenUrl = `${url}/realms/${realm}/protocol/openid-connect/token`
const rolesUrl = (role: string) =>
  `${url}/admin/realms/${realm}/roles/${encodeURIComponent(role)}/groups`
const membersUrl = (groupId: string) =>
  `${url}/admin/realms/${realm}/groups/${encodeURIComponent(groupId)}/members`

const mockServer = setupServer()

function tokenHandler(token = 'test-token', expiresIn = 300, status = 200) {
  return http.post(tokenUrl, () =>
    status === 200
      ? HttpResponse.json(
          { access_token: token, expires_in: expiresIn },
          { status }
        )
      : new HttpResponse(null, { status })
  )
}

describe('keycloak-admin-adapter', () => {
  // Re-import the module for each test to reset module-level cachedToken / tokenPromise.
  // jest.doMock ensures the utilities mock uses the same axios instance as the
  // freshly evaluated adapter, so AxiosError class identity checks work correctly.
  let getUsersByRole: typeof import('../keycloak-admin-adapter').getUsersByRole

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
          info: () => {
            return
          },
          error: () => {
            return
          },
          debug: () => {
            return
          },
        },
        loggedAxios: ax.default ?? ax,
        axiosTypes: ax.default ?? ax,
        generateRouteMetadata: jest.fn(),
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    getUsersByRole = require('../keycloak-admin-adapter').getUsersByRole
  })

  afterEach(() => {
    mockServer.resetHandlers()
  })

  afterAll(() => {
    mockServer.close()
  })

  describe('getUsersByRole', () => {
    it('returns users from a single group', async () => {
      const user = { id: 'u1', username: 'alice' }

      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('admin'), () =>
          HttpResponse.json([{ id: 'g1' }], { status: 200 })
        ),
        http.get(membersUrl('g1'), () =>
          HttpResponse.json([user], { status: 200 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({ ok: true, data: [user] })
    })

    it('deduplicates users across multiple groups', async () => {
      const alice = { id: 'u1', username: 'alice' }
      const bob = { id: 'u2', username: 'bob' }

      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('admin'), () =>
          HttpResponse.json([{ id: 'g1' }, { id: 'g2' }], { status: 200 })
        ),
        http.get(membersUrl('g1'), () =>
          HttpResponse.json([alice, bob], { status: 200 })
        ),
        http.get(membersUrl('g2'), () =>
          HttpResponse.json([alice], { status: 200 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({ ok: true, data: [alice, bob] })
    })

    it('returns empty array when role has no groups', async () => {
      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('empty-role'), () =>
          HttpResponse.json([], { status: 200 })
        )
      )

      const result = await getUsersByRole('empty-role')

      expect(result).toEqual({ ok: true, data: [] })
    })

    it('retries with fresh token on 401 from groups endpoint', async () => {
      const user = { id: 'u1', username: 'alice' }
      let groupCallCount = 0

      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('admin'), () => {
          groupCallCount++
          if (groupCallCount === 1) {
            return new HttpResponse(null, { status: 401 })
          }
          return HttpResponse.json([{ id: 'g1' }], { status: 200 })
        }),
        http.get(membersUrl('g1'), () =>
          HttpResponse.json([user], { status: 200 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(groupCallCount).toBe(2)
      expect(result).toEqual({ ok: true, data: [user] })
    })

    it('returns keycloak_unreachable when token request has no response (network error)', async () => {
      mockServer.use(http.post(tokenUrl, () => HttpResponse.error()))

      const result = await getUsersByRole('admin')

      expect(result).toEqual({
        ok: false,
        err: 'keycloak_unreachable',
        statusCode: 502,
      })
    })

    it('returns unauthorized on 401 after retry also fails', async () => {
      mockServer.use(
        tokenHandler(),
        http.get(
          rolesUrl('admin'),
          () => new HttpResponse(null, { status: 401 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({
        ok: false,
        err: 'unauthorized',
        statusCode: 401,
      })
    })

    it('returns forbidden on 403 from groups endpoint', async () => {
      mockServer.use(
        tokenHandler(),
        http.get(
          rolesUrl('admin'),
          () => new HttpResponse(null, { status: 403 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({
        ok: false,
        err: 'forbidden',
        statusCode: 403,
      })
    })

    it('returns role_not_found on 404 from groups endpoint', async () => {
      mockServer.use(
        tokenHandler(),
        http.get(
          rolesUrl('admin'),
          () => new HttpResponse(null, { status: 404 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({
        ok: false,
        err: 'role_not_found',
        statusCode: 404,
      })
    })

    it('returns unknown with status code on unrecognized HTTP error', async () => {
      mockServer.use(
        tokenHandler(),
        http.get(
          rolesUrl('admin'),
          () => new HttpResponse(null, { status: 500 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({
        ok: false,
        err: 'unknown',
        statusCode: 500,
      })
    })

    it('returns unknown 500 on non-Axios error', async () => {
      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('admin'), () => {
          throw new Error('unexpected')
        })
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({
        ok: false,
        err: 'unknown',
        statusCode: 500,
      })
    })
  })
})
