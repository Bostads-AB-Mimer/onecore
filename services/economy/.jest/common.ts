import axios from 'axios'

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
  }
})
