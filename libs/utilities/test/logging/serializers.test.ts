import { Writable } from 'node:stream'
import pino from 'pino'
import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios'

import { logger } from '../../src/logging/logger'
import {
  redactPaths,
  serializeError,
  serializers,
} from '../../src/logging/serializers'

const SECRETS = [
  'FAKE-BEARER',
  'FAKE-CLIENT-SECRET',
  'FAKE-PASSWORD',
  'FAKE-COOKIE',
  'FAKE-RAW-HEADER',
]

// A pino logger with the same options as ours, writing to a string.
const capture = () => {
  let out = ''
  const stream = new Writable({
    write(chunk, _encoding, done) {
      out += chunk.toString()
      done()
    },
  })
  const log = pino(
    { serializers, redact: { paths: redactPaths, censor: '[REDACTED]' } },
    stream
  )
  return { log, output: () => out }
}

const config = {
  method: 'post',
  url: 'https://keycloak.example/realms/r/protocol/openid-connect/token',
  headers: new AxiosHeaders({ Authorization: 'Bearer FAKE-BEARER' }),
  data: 'grant_type=client_credentials&client_secret=FAKE-CLIENT-SECRET',
  auth: { username: 'svc', password: 'FAKE-PASSWORD' },
} as unknown as InternalAxiosRequestConfig

// What axios puts on errors and responses: Node's ClientRequest, whose raw
// header string includes Authorization.
const clientRequest = {
  method: 'POST',
  host: 'keycloak.example',
  path: '/realms/r/protocol/openid-connect/token',
  _header: 'POST / HTTP/1.1\r\nAuthorization: Bearer FAKE-RAW-HEADER\r\n',
  getHeader: () => undefined,
}

const response = {
  status: 401,
  statusText: 'Unauthorized',
  data: { error: 'invalid_client' },
  headers: { 'set-cookie': 'session=FAKE-COOKIE' },
  config,
  request: clientRequest,
}

const axiosError = () =>
  new AxiosError(
    'Request failed with status code 401',
    'ERR_BAD_REQUEST',
    config,
    clientRequest,
    response as never
  )

const expectNoSecrets = (output: string) => {
  for (const secret of SECRETS) expect(output).not.toContain(secret)
}

describe('logging axios errors and responses', () => {
  it('our logger uses these serializers', () => {
    const configured = (logger as any)[pino.symbols.serializersSym]
    expect(configured.err).toBe(serializeError)
    expect(configured.error).toBe(serializeError)
  })

  it.each([
    ['logger.error(err)', (log: pino.Logger) => log.error(axiosError(), 'x')],
    ['{ err }', (log: pino.Logger) => log.error({ err: axiosError() }, 'x')],
    [
      '{ error }',
      (log: pino.Logger) => log.error({ error: axiosError() }, 'x'),
    ],
  ])(
    'summarizes an axios error logged as %s, without credentials',
    (_, write) => {
      const { log, output } = capture()

      write(log)

      expectNoSecrets(output())
      const line = JSON.parse(output())
      const logged = line.err ?? line.error
      expect(logged.stack).toContain('Request failed')
      expect(logged).toMatchObject({
        type: 'AxiosError',
        message: 'Request failed with status code 401',
        code: 'ERR_BAD_REQUEST',
        status: 401,
        method: 'POST',
        url: config.url,
        responseData: '{"error":"invalid_client"}',
      })
    }
  )

  it('summarizes an axios response logged as the object itself', () => {
    // As infobip-adapter does: logger.error(response, 'Error sending email')
    const { log, output } = capture()

    log.error(response, 'x')

    expectNoSecrets(output())
    const line = JSON.parse(output())
    expect(line.status).toBe(401)
    expect(line.config).toEqual({ method: 'POST', url: config.url })
    expect(line.request).toEqual({
      method: 'POST',
      host: 'keycloak.example',
      path: '/realms/r/protocol/openid-connect/token',
    })
    expect(line.headers['set-cookie']).toBe('[REDACTED]')
  })

  it('censors an axios error logged under any other key', () => {
    const { log, output } = capture()

    log.error({ emailErr: axiosError() }, 'x')

    expectNoSecrets(output())
  })

  it("leaves Koa's own request field alone", () => {
    const { log, output } = capture()

    log.info({ request: { path: '/leases', method: 'GET', ip: '::1' } }, 'x')

    expect(JSON.parse(output()).request).toEqual({
      path: '/leases',
      method: 'GET',
      ip: '::1',
    })
  })

  it('logs other errors as before, with message, stack and own fields', () => {
    const { log, output } = capture()
    const err = Object.assign(new Error('boom'), { leaseId: 'L1' })

    log.error(err, 'x')

    const logged = JSON.parse(output()).err
    expect(logged.message).toBe('boom')
    expect(logged.stack).toContain('boom')
    expect(logged.leaseId).toBe('L1')
  })

  it('caps long response bodies', () => {
    const big = { ...response, data: 'x'.repeat(5000) }
    const summary = serializeError({ ...big, isAxiosError: false }) as {
      responseData: string
    }
    expect(summary.responseData.length).toBeLessThanOrEqual(2001)
  })

  it.each([
    ['a stream response', { pipe: () => undefined, on: () => undefined }],
    [
      'circular data',
      (() => {
        const data: Record<string, unknown> = {}
        data.self = data
        return data
      })(),
    ],
  ])('never throws, and keeps logging, on %s', (_, data) => {
    const { log, output } = capture()
    const err = axiosError()
    ;(err.response as { data: unknown }).data = data

    expect(() => log.error(err, 'x')).not.toThrow()
    expect(() => log.error({ err }, 'x')).not.toThrow()

    expect(output().split('\n').filter(Boolean)).toHaveLength(2)
    expectNoSecrets(output())
  })

  it('decodes a Buffer response body', () => {
    const err = axiosError()
    ;(err.response as { data: unknown }).data = Buffer.from('{"error":"x"}')

    expect(serializeError(err)).toMatchObject({ responseData: '{"error":"x"}' })
  })

  it('falls back instead of throwing when reading the error throws', () => {
    const hostile = Object.defineProperty(new Error('boom'), 'isAxiosError', {
      get() {
        throw new Error('getter')
      },
    })

    expect(serializeError(hostile)).toEqual({
      type: 'Unserializable',
      message: 'boom',
    })
  })

  it('summarizes a network error without a response', () => {
    const err = new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED', config)

    expect(serializeError(err)).toMatchObject({
      type: 'AxiosError',
      code: 'ECONNREFUSED',
      url: config.url,
      responseData: undefined,
    })
  })

  it('summarizes an axios response logged as { response }', () => {
    const { log, output } = capture()

    log.error({ response }, 'x')

    expectNoSecrets(output())
    expect(JSON.parse(output()).response).toMatchObject({
      type: 'AxiosResponse',
      status: 401,
    })
  })

  it('applies to child loggers too', () => {
    const { log, output } = capture()

    log.child({ correlationId: 'c1' }).error(axiosError(), 'x')

    expectNoSecrets(output())
  })

  it('does not cover an axios error nested two levels down (documented)', () => {
    const { log, output } = capture()

    log.error({ details: { err: axiosError() } }, 'x')

    expect(output()).toContain('FAKE-CLIENT-SECRET')
  })
})
