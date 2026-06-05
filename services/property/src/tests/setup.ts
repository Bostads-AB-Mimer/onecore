jest.mock('@onecore/utilities', () => {
  const actual = jest.requireActual('@onecore/utilities')

  return {
    ...actual,
    logger: {
      info: () => {
        return
      },
      warn: () => {
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
