import axios from 'axios'
jest.mock('@onecore/utilities', () => {
  const { errorName, errorMessage, redactedMessage } =
    jest.requireActual('@onecore/utilities')
  return {
    errorName,
    errorMessage,
    redactedMessage,
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
    generateRouteMetadata: jest.fn(),
  }
})
