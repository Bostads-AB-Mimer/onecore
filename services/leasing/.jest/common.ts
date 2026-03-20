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
    },
    generateRouteMetadata: jest.fn(() => {}),
    makeSuccessResponseBody: utilities.makeSuccessResponseBody,
    buildPaginatedResponse: utilities.buildPaginatedResponse,
    buildPaginationLinks: utilities.buildPaginationLinks,
    parsePaginationParams: utilities.parsePaginationParams,
  }
})
