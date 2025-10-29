import axios from 'axios'
const utilities = jest.requireActual('@onecore/utilities')
jest.mock('@onecore/utilities', () => {
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
    loggedAxios: axios,
    axiosTypes: axios,
    makeSuccessResponseBody: utilities.makeSuccessResponseBody,
    generateRouteMetadata: jest.fn(),
  }
})
