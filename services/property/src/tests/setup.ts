jest.mock('@onecore/utilities', () => {
  const actual = jest.requireActual('@onecore/utilities')

  return {
    ...actual,
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
