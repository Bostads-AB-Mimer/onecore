import { AxiosError, AxiosHeaders } from 'axios'

import { logger } from '../../src/logging/logger'
import { lastLine, written } from './helpers/captureLogs'

jest.mock('pino-elasticsearch', () => {
  const helpers = require('./helpers/captureLogs')
  return { __esModule: true, default: () => helpers.captureStream() }
})

jest.mock('pino-pretty', () => {
  const helpers = require('./helpers/captureLogs')
  return { __esModule: true, default: () => helpers.discardStream() }
})

const ALLOWED = ['type', 'message', 'stack', 'status', 'code']
const BODY_VALUE = 'tenant-personal-body-value'
const HEADER_VALUE = 'secret-header-value'

const buildAxiosError = () => {
  const config = {
    url: 'https://example.invalid/api',
    method: 'get',
    headers: new AxiosHeaders({ 'x-req-header': HEADER_VALUE }),
  }
  const response = {
    status: 502,
    statusText: 'Bad Gateway',
    headers: { 'x-res-header': HEADER_VALUE },
    data: { detail: BODY_VALUE, nested: { a: 1, b: 2 } },
    config,
  }
  return new AxiosError(
    'Request failed',
    'ERR_BAD_RESPONSE',
    config as any,
    { socketPath: HEADER_VALUE },
    response as any
  )
}

const expectOnlyAllowedFields = (
  line: Record<string, any>,
  key: 'err' | 'error'
) => {
  const serialized = line[key]
  expect(typeof serialized).toBe('object')
  for (const k of Object.keys(serialized)) {
    expect(ALLOWED).toContain(k)
  }
  expect(serialized.message).toBe('Request failed')
  expect(serialized.code).toBe('ERR_BAD_RESPONSE')
  expect(serialized.status).toBe(502)
  const raw = written[written.length - 1]
  expect(raw).not.toContain(BODY_VALUE)
  expect(raw).not.toContain(HEADER_VALUE)
}

describe('logging an AxiosError', () => {
  it('as a bare first argument keeps only the allowed error fields', () => {
    logger.error(buildAxiosError(), 'failed')
    expectOnlyAllowedFields(lastLine(), 'err')
  })

  it('as { err } keeps only the allowed error fields', () => {
    logger.error({ err: buildAxiosError() }, 'failed')
    expectOnlyAllowedFields(lastLine(), 'err')
  })

  it('as { error } keeps only the allowed error fields', () => {
    logger.error({ error: buildAxiosError() }, 'failed')
    expectOnlyAllowedFields(lastLine(), 'error')
  })
})

describe('logging a string as the error', () => {
  it('turns { error: "x" } into an object with message', () => {
    logger.error({ error: 'x' }, 'failed')
    expect(typeof lastLine().error).toBe('object')
    expect(lastLine().error).toMatchObject({ message: 'x' })
  })

  it('turns { err: "x" } into an object with message', () => {
    logger.error({ err: 'x' }, 'failed')
    expect(typeof lastLine().err).toBe('object')
    expect(lastLine().err).toMatchObject({ message: 'x' })
  })
})
