jest.mock('onecore-utilities', () => {
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
    loggedAxios: jest.fn(),
    axiosTypes: jest.fn(),
    generateRouteMetadata: jest.fn(),
  }
})
