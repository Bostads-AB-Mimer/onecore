jest.mock('pino-elasticsearch', () => {
  const helpers = require('./helpers/captureLogs')
  return {
    __esModule: true,
    default: (opts: { index?: unknown }) => {
      helpers.elasticOptions.push(opts)
      return helpers.captureStream()
    },
  }
})

jest.mock('pino-pretty', () => {
  const helpers = require('./helpers/captureLogs')
  return { __esModule: true, default: () => helpers.discardStream() }
})

describe('Elasticsearch index name', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('is onecore-logging-YYYY.MM for the current month', () => {
    jest.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z') })
    let index: unknown
    jest.isolateModules(() => {
      require('../../src/logging/logger')
      const { elasticOptions } = require('./helpers/captureLogs')
      index = elasticOptions[elasticOptions.length - 1].index
    })

    const resolved =
      typeof index === 'function' ? (index as Function)({}) : index
    expect(resolved).toBe('onecore-logging-2026.11')
  })
})
