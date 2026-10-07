// Mock utilities to prevent console output during tests; keep the real helpers
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
    },
    generateRouteMetadata: jest.fn(() => ({})),
  }
})

// Never talk to DAX from tests. searchCardOwners answers "no owners" by default;
// tests that need data override it with jest.spyOn. The rest fail loudly.
jest.mock('../src/services/key-service/adapters/dax-adapter', () => {
  const notMocked = (name: string) => async () => {
    throw new Error(`DAX is mocked in tests: ${name} needs a jest.spyOn`)
  }
  return {
    __esModule: true, // keeps exports spy-able under ts-jest's import * interop
    searchCardOwners: async () => [],
    getCardOwnerById: notMocked('getCardOwnerById'),
    getCardById: notMocked('getCardById'),
    getContracts: notMocked('getContracts'),
  }
})
