import axios from 'axios'
import nock from 'nock'

// Tests must not reach real services. supertest talks to the app over
// localhost, so only that is allowed; an unmocked outgoing call fails.
nock.disableNetConnect()
nock.enableNetConnect((host) =>
  /^(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?$/.test(host)
)

const utilities = jest.requireActual('@onecore/utilities')

jest.mock('@onecore/utilities', () => {
  return {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    },
    loggedAxios: axios,
    axiosTypes: axios,
    generateRouteMetadata: utilities.generateRouteMetadata,
    makeSuccessResponseBody: utilities.makeSuccessResponseBody,
    errorMessage: utilities.errorMessage,
    errorName: utilities.errorName,
    redactedMessage: utilities.redactedMessage,
    chunk: utilities.chunk,
  }
})
