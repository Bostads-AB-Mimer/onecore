import dotenv from 'dotenv'

// Ensure that we load the correct dotenv configuration
dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH,
})

// Mock any pino stuff as "side effects on import" is apparently a great pattern
// if you ask some people.
jest.mock('pino-multi-stream', () => {
  return {
    multistream: () => {
      return () => {}
    },
  }
})
jest.mock('pino', () => {
  return jest.fn(() => {
    return {
      child: () => {
        return
      },
    }
  })
})
jest.mock('pino-elasticsearch', () => {
  return jest.fn(() => ({
    on: jest.fn(),
  }))
})

// Mock the relevant parts of @onecore/utilities itself
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
    },
  }
})
