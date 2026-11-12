import axios, { AxiosHeaders } from 'axios'

import { logger, middlewares } from '../../src/logging/logger'
import '../../src/logging/loggedAxios'
import { lastLine, written } from './helpers/captureLogs'

jest.mock('pino-elasticsearch', () => {
  const helpers = require('./helpers/captureLogs')
  return { __esModule: true, default: () => helpers.captureStream() }
})

jest.mock('pino-pretty', () => {
  const helpers = require('./helpers/captureLogs')
  return { __esModule: true, default: () => helpers.discardStream() }
})

describe('axios interceptors', () => {
  it('log no headers key on request or response', async () => {
    written.length = 0
    await axios.get('https://example.invalid/api', {
      headers: { 'x-custom': 'v' },
      adapter: async (config) => ({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders({ 'x-res': 'v' }),
        config,
      }),
    })

    const lines = written.map((l) => JSON.parse(l))
    const request = lines.find((l) => l.msg?.startsWith('HTTP request'))
    const response = lines.find((l) => l.msg?.startsWith('HTTP response'))
    expect(request).toBeDefined()
    expect(response).toBeDefined()
    expect(request).not.toHaveProperty('headers')
    expect(response).not.toHaveProperty('headers')
  })
})

describe('Koa post-request middleware', () => {
  it('logs request.user as { id } only', async () => {
    const ctx: any = {
      path: '/things',
      method: 'GET',
      status: 200,
      header: {},
      request: { ip: '127.0.0.1' },
      state: {
        user: {
          id: 'user-1',
          email: 'anna@example.com',
          name: 'Anna Berg',
          roles: ['admin'],
          employeeId: 'E1',
        },
      },
      logger,
    }

    await middlewares.post(ctx, async () => undefined)

    const line = lastLine()
    expect(line.msg).toBe('Incoming request complete')
    expect(line.request.user).toEqual({ id: 'user-1' })
  })
})
