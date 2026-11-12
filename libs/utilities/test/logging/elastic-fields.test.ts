import {
  toElasticDocument,
  toElasticLine,
} from '../../src/logging/elastic-fields'

describe('toElasticDocument', () => {
  it('keeps top-level strings, numbers, booleans, null and arrays of those', () => {
    const doc = {
      level: 30,
      msg: 'Imported',
      contactCode: 'P123456',
      dryRun: false,
      skipped: null,
      pageIds: [1, 2, 3],
    }

    expect(toElasticDocument(doc)).toEqual(doc)
  })

  it('drops top-level objects that are not on the list', () => {
    expect(
      toElasticDocument({
        msg: 'HTTP request',
        headers: { Accept: 'application/json', 'X-Version': '1' },
        missingFacilities: { '226062999124': 'missing' },
        data: { content: { a: 1 } },
      })
    ).toEqual({ msg: 'HTTP request' })
  })

  it('drops arrays that hold objects', () => {
    expect(
      toElasticDocument({ msg: 'x', issues: [{ path: ['a'], code: 'bad' }] })
    ).toEqual({ msg: 'x' })
  })

  it('keeps only the listed fields of err and error', () => {
    const axiosLike = {
      type: 'AxiosError',
      message: 'Request failed with status code 500',
      stack: 'AxiosError: Request failed\n    at settle',
      code: 'ERR_BAD_RESPONSE',
      status: 500,
      config: { headers: { Authorization: 'Bearer secret' }, url: '/x' },
      request: { _header: 'GET /x' },
      response: { data: { big: 'payload' } },
    }

    expect(
      toElasticDocument({ msg: 'failed', err: axiosLike, error: axiosLike })
    ).toEqual({
      msg: 'failed',
      err: {
        type: 'AxiosError',
        message: 'Request failed with status code 500',
        stack: 'AxiosError: Request failed\n    at settle',
        code: 'ERR_BAD_RESPONSE',
        status: 500,
      },
      error: {
        message: 'Request failed with status code 500',
        stack: 'AxiosError: Request failed\n    at settle',
        code: 'ERR_BAD_RESPONSE',
        status: 500,
      },
    })
  })

  it('keeps request path, method, ip, status and the user id and username', () => {
    expect(
      toElasticDocument({
        request: {
          path: '/leases',
          method: 'GET',
          ip: '10.0.0.1',
          status: 200,
          body: { lots: 'of data' },
          user: {
            id: 'u1',
            username: 'anna',
            email: 'anna@example.com',
            realm_access: { roles: ['api-access'] },
          },
        },
      })
    ).toEqual({
      request: {
        path: '/leases',
        method: 'GET',
        ip: '10.0.0.1',
        status: 200,
        user: { id: 'u1', username: 'anna' },
      },
    })
  })

  it('keeps application name and environment', () => {
    expect(
      toElasticDocument({
        application: { name: 'core', environment: 'production', extra: 1 },
      })
    ).toEqual({ application: { name: 'core', environment: 'production' } })
  })

  it('drops a listed field whose value is an object', () => {
    expect(
      toElasticDocument({ err: { message: 'x', code: { nested: true } } })
    ).toEqual({ err: { message: 'x' } })
  })

  it('drops a listed object left empty after filtering', () => {
    expect(toElasticDocument({ msg: 'x', err: { config: {} } })).toEqual({
      msg: 'x',
    })
  })

  it('keeps a scalar err or error as it is', () => {
    expect(toElasticDocument({ err: 'timeout' })).toEqual({ err: 'timeout' })
  })
})

describe('toElasticLine', () => {
  it('filters one pino line and ends it with a newline', () => {
    const line = JSON.stringify({ msg: 'x', headers: { Accept: '*/*' } })

    expect(toElasticLine(line)).toBe('{"msg":"x"}\n')
  })

  it('passes a line that is not JSON through unchanged', () => {
    expect(toElasticLine('not json\n')).toBe('not json\n')
  })
})
