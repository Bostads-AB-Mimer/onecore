import dotenv from 'dotenv'

dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH,
})

// The logger in @onecore/utilities opens elasticsearch streams on import.
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
  }
})
