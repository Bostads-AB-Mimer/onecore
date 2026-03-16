const utilities = jest.requireActual('@onecore/utilities')
jest.mock('@onecore/utilities', () => {
  return {
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
    },
    generateRouteMetadata: jest.fn(() => {}),
    makeSuccessResponseBody: utilities.makeSuccessResponseBody,
  }
})
