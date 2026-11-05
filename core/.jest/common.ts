jest.mock('@onecore/utilities', () => {
  const axios = jest.requireActual('axios')
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
      warn: () => {
        return
      },
      debug: () => {
        return
      },
      warn: () => {
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
