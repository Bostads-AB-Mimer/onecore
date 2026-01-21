jest.mock('@onecore/utilities', () => {
  const axios = jest.requireActual('axios')
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
    // Use axios.create() to get a fresh instance without interceptors
    loggedAxios: axios,
    axiosTypes: axios,
    generateRouteMetadata: jest.fn(),
    makeSuccessResponseBody: <T>(content: T, metadata: object) => ({
      content,
      ...metadata,
    }),
  }
})
