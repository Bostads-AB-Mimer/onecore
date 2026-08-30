import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Use a fixed tenant ID so the token URL is well-formed in tests
const TEST_TENANT_ID = 'test-tenant-id'

jest.mock('../../common/config', () => ({
  __esModule: true,
  default: {
    microsoftGraph: {
      tenantId: TEST_TENANT_ID,
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    },
  },
}))

const tokenUrl = `https://login.microsoftonline.com/${TEST_TENANT_ID}/oauth2/v2.0/token`

const mockServer = setupServer()

describe('microsoft-graph-adapter', () => {
  let listUsers: typeof import('../microsoft-graph-adapter').listUsers

  beforeAll(() => mockServer.listen())
  beforeEach(() => {
    jest.resetModules()
    jest.doMock('../../common/config', () => ({
      __esModule: true,
      default: {
        microsoftGraph: {
          tenantId: TEST_TENANT_ID,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      },
    }))
    jest.doMock('@onecore/utilities', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ax = require('axios')
      return {
        logger: { info: () => {}, error: () => {}, debug: () => {} },
        loggedAxios: ax.default ?? ax,
        axiosTypes: ax.default ?? ax,
        generateRouteMetadata: jest.fn(),
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    listUsers = require('../microsoft-graph-adapter').listUsers
  })
  afterEach(() => mockServer.resetHandlers())
  afterAll(() => mockServer.close())

  it('fetches a token using client_credentials and lists users', async () => {
    mockServer.use(
      http.post(tokenUrl, () =>
        HttpResponse.json({ access_token: 't', expires_in: 3600 })
      ),
      http.get('https://graph.microsoft.com/v1.0/users', () =>
        HttpResponse.json({
          value: [{ id: 'g1', userPrincipalName: 'a@x.se', employeeId: 'E1' }],
        })
      )
    )

    const result = await listUsers()
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'g1',
          userPrincipalName: 'a@x.se',
          employeeId: 'E1',
          managerUpn: null,
        },
      ],
    })
  })

  it('expands the manager relationship and flattens it to managerUpn', async () => {
    let requestUrl: string | undefined
    mockServer.use(
      http.post(tokenUrl, () =>
        HttpResponse.json({ access_token: 't', expires_in: 3600 })
      ),
      http.get('https://graph.microsoft.com/v1.0/users', ({ request }) => {
        requestUrl = request.url
        return HttpResponse.json({
          value: [
            {
              id: 'g1',
              userPrincipalName: 'a@x.se',
              employeeId: 'E1',
              manager: { id: 'g9', userPrincipalName: 'boss@x.se' },
            },
            {
              id: 'g2',
              userPrincipalName: 'b@x.se',
              employeeId: 'E2',
              manager: null,
            },
          ],
        })
      })
    )

    const result = await listUsers()
    if (!result.ok) throw new Error('expected ok')

    // Query asks Graph to expand the manager navigation property
    const url = new URL(requestUrl ?? '')
    expect(url.searchParams.get('$expand')).toBe(
      'manager($select=id,userPrincipalName)'
    )

    // Nested manager is flattened to a scalar managerUpn; absent manager -> null
    expect(result.data[0].managerUpn).toBe('boss@x.se')
    expect(result.data[1].managerUpn).toBeNull()
    // Nested `manager` object is not leaked onto GraphUser
    expect('manager' in result.data[0]).toBe(false)
  })

  it('follows @odata.nextLink for pagination', async () => {
    let calls = 0
    mockServer.use(
      http.post(tokenUrl, () =>
        HttpResponse.json({ access_token: 't', expires_in: 3600 })
      ),
      http.get('https://graph.microsoft.com/v1.0/users', () => {
        calls += 1
        if (calls === 1) {
          return HttpResponse.json({
            value: [
              { id: 'g1', userPrincipalName: 'a@x.se', employeeId: 'E1' },
            ],
            '@odata.nextLink':
              'https://graph.microsoft.com/v1.0/users?$skiptoken=abc',
          })
        }
        return HttpResponse.json({
          value: [{ id: 'g2', userPrincipalName: 'b@x.se', employeeId: 'E2' }],
        })
      })
    )

    const result = await listUsers()
    if (!result.ok) throw new Error('expected ok')
    expect(result.data).toHaveLength(2)
  })
})
