import axios from 'axios'
jest.mock('@onecore/utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
      warn: () => {
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
