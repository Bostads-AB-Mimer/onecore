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
      data: [{ id: 'g1', userPrincipalName: 'a@x.se', employeeId: 'E1' }],
    })
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
