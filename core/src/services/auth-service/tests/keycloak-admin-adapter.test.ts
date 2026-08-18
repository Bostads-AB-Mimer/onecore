import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import config from '../../../common/config'

const { url, realm } = config.auth.keycloak
const tokenUrl = `${url}/realms/${realm}/protocol/openid-connect/token`
const rolesUrl = (role: string) =>
  `${url}/admin/realms/${realm}/roles/${encodeURIComponent(role)}/groups`
const membersUrl = (groupId: string) =>
  `${url}/admin/realms/${realm}/groups/${encodeURIComponent(groupId)}/members`
const childrenUrl = (groupId: string) =>
  `${url}/admin/realms/${realm}/groups/${encodeURIComponent(groupId)}/children`

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
        http.get(childrenUrl('g1'), () =>
          HttpResponse.json([], { status: 200 })
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
        http.get(childrenUrl('g1'), () =>
          HttpResponse.json([], { status: 200 })
        ),
        http.get(childrenUrl('g2'), () =>
          HttpResponse.json([], { status: 200 })
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

    it('includes members of subgroups of role-mapped groups', async () => {
      const alice = { id: 'u1', username: 'alice' }
      const bob = { id: 'u2', username: 'bob' }
      const carol = { id: 'u3', username: 'carol' }

      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('admin'), () =>
          HttpResponse.json([{ id: 'parent' }], { status: 200 })
        ),
        http.get(childrenUrl('parent'), () =>
          HttpResponse.json([{ id: 'sub-a' }, { id: 'sub-b' }], { status: 200 })
        ),
        http.get(childrenUrl('sub-a'), () =>
          HttpResponse.json([], { status: 200 })
        ),
        http.get(childrenUrl('sub-b'), () =>
          HttpResponse.json([], { status: 200 })
        ),
        http.get(membersUrl('parent'), () =>
          HttpResponse.json([alice], { status: 200 })
        ),
        http.get(membersUrl('sub-a'), () =>
          HttpResponse.json([bob], { status: 200 })
        ),
        http.get(membersUrl('sub-b'), () =>
          HttpResponse.json([carol], { status: 200 })
        )
      )

      const result = await getUsersByRole('admin')

      if (!result.ok) throw new Error('expected ok')
      expect(result.data).toEqual(expect.arrayContaining([alice, bob, carol]))
      expect(result.data).toHaveLength(3)
    })

    it('descends recursively into nested subgroups', async () => {
      const alice = { id: 'u1', username: 'alice' }
      const grandchildMember = { id: 'u2', username: 'deep' }

      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('admin'), () =>
          HttpResponse.json([{ id: 'parent' }], { status: 200 })
        ),
        http.get(childrenUrl('parent'), () =>
          HttpResponse.json([{ id: 'child' }], { status: 200 })
        ),
        http.get(childrenUrl('child'), () =>
          HttpResponse.json([{ id: 'grandchild' }], { status: 200 })
        ),
        http.get(childrenUrl('grandchild'), () =>
          HttpResponse.json([], { status: 200 })
        ),
        http.get(membersUrl('parent'), () =>
          HttpResponse.json([alice], { status: 200 })
        ),
        http.get(membersUrl('child'), () =>
          HttpResponse.json([], { status: 200 })
        ),
        http.get(membersUrl('grandchild'), () =>
          HttpResponse.json([grandchildMember], { status: 200 })
        )
      )

      const result = await getUsersByRole('admin')

      if (!result.ok) throw new Error('expected ok')
      expect(result.data).toEqual(
        expect.arrayContaining([alice, grandchildMember])
      )
      expect(result.data).toHaveLength(2)
    })

    it('deduplicates a user present in both parent and subgroup', async () => {
      const alice = { id: 'u1', username: 'alice' }

      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('admin'), () =>
          HttpResponse.json([{ id: 'parent' }], { status: 200 })
        ),
        http.get(childrenUrl('parent'), () =>
          HttpResponse.json([{ id: 'child' }], { status: 200 })
        ),
        http.get(childrenUrl('child'), () =>
          HttpResponse.json([], { status: 200 })
        ),
        http.get(membersUrl('parent'), () =>
          HttpResponse.json([alice], { status: 200 })
        ),
        http.get(membersUrl('child'), () =>
          HttpResponse.json([alice], { status: 200 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({ ok: true, data: [alice] })
    })

    it('pages through /children when a group has more than 100 subgroups', async () => {
      const member = { id: 'sub-member', username: 'sub-member' }
      const pageOne = Array.from({ length: 100 }, (_, i) => ({
        id: `sub-${i}`,
      }))
      const pageTwo = [{ id: 'sub-100' }]

      mockServer.use(
        tokenHandler(),
        http.get(rolesUrl('admin'), () =>
          HttpResponse.json([{ id: 'parent' }], { status: 200 })
        ),
        http.get(childrenUrl('parent'), ({ request }) => {
          const u = new URL(request.url)
          const first = Number(u.searchParams.get('first') ?? '0')
          if (first === 0) return HttpResponse.json(pageOne, { status: 200 })
          if (first === 100) return HttpResponse.json(pageTwo, { status: 200 })
          return HttpResponse.json([], { status: 200 })
        }),
        // Every subgroup reports no further children
        http.get(/\/groups\/[^/]+\/children$/, () =>
          HttpResponse.json([], { status: 200 })
        ),
        http.get(membersUrl('parent'), () =>
          HttpResponse.json([], { status: 200 })
        ),
        // sub-100 has the only member; every other subgroup is empty
        http.get(membersUrl('sub-100'), () =>
          HttpResponse.json([member], { status: 200 })
        ),
        http.get(/\/groups\/[^/]+\/members$/, () =>
          HttpResponse.json([], { status: 200 })
        )
      )

      const result = await getUsersByRole('admin')

      expect(result).toEqual({ ok: true, data: [member] })
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
        http.get(childrenUrl('g1'), () =>
          HttpResponse.json([], { status: 200 })
        ),
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

  describe('listAllUsers', () => {
    let listAllUsers: typeof import('../keycloak-admin-adapter').listAllUsers
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      listAllUsers = require('../keycloak-admin-adapter').listAllUsers
    })

    it('returns paged users', async () => {
      const usersUrl = `${url}/admin/realms/${realm}/users`
      let page = 0
      mockServer.use(
        tokenHandler(),
        http.get(usersUrl, () => {
          page += 1
          if (page === 1) {
            // 100 users — full page → adapter requests next page
            const fullPage = Array.from({ length: 100 }, (_, i) => ({
              id: `u${i}`,
              username: `user${i}`,
            }))
            return HttpResponse.json(fullPage)
          }
          return HttpResponse.json([{ id: 'u100', username: 'user100' }])
        })
      )

      const result = await listAllUsers()
      if (!result.ok) throw new Error('expected ok')
      expect(result.data).toHaveLength(101)
    })
  })

  describe('getUserById and updateUser', () => {
    let getUserById: typeof import('../keycloak-admin-adapter').getUserById
    let updateUser: typeof import('../keycloak-admin-adapter').updateUser
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      getUserById = require('../keycloak-admin-adapter').getUserById
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      updateUser = require('../keycloak-admin-adapter').updateUser
    })

    it('fetches one user', async () => {
      mockServer.use(
        tokenHandler(),
        http.get(`${url}/admin/realms/${realm}/users/u1`, () =>
          HttpResponse.json({ id: 'u1', username: 'alice' })
        )
      )
      const r = await getUserById('u1')
      if (!r.ok) throw new Error('expected ok')
      expect(r.data.id).toBe('u1')
    })

    it('sends full UserRepresentation on PUT', async () => {
      let received: unknown
      mockServer.use(
        tokenHandler(),
        http.put(
          `${url}/admin/realms/${realm}/users/u1`,
          async ({ request }) => {
            received = await request.json()
            return new HttpResponse(null, { status: 204 })
          }
        )
      )
      const r = await updateUser({
        id: 'u1',
        username: 'alice',
        attributes: { employeeId: ['E42'] },
      })
      expect(r.ok).toBe(true)
      expect(received).toMatchObject({
        id: 'u1',
        username: 'alice',
        attributes: { employeeId: ['E42'] },
      })
    })
  })
})
