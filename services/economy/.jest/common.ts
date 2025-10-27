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
    generateRouteMetadata: utilities.generateRouteMetadata,
    makeSuccessResponseBody: utilities.makeSuccessResponseBody,
  }
})
