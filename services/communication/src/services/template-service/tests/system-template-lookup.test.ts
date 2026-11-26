jest.mock('@onecore/utilities', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}))

// A DB that fails every query: the lookup must surface a typed error.
jest.mock('../../../common/db', () => ({
  db: () => {
    throw new Error('connection refused')
  },
}))

import { getSystemTemplate } from '../adapters/db'
import { SystemTemplateLookupError } from '../system-templates'

describe('getSystemTemplate', () => {
  it('throws SystemTemplateLookupError when the DB read fails', async () => {
    await expect(getSystemTemplate('work_order')).rejects.toBeInstanceOf(
      SystemTemplateLookupError
    )
  })
})
