import { randomUUID } from 'crypto'

import * as guidesAdapter from '../communication-adapter/guides'
import { client } from '../communication-adapter/helpers'

jest.mock('@onecore/utilities', () => ({
  ...jest.requireActual('@onecore/utilities'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

afterEach(() => jest.restoreAllMocks())

describe('communication-adapter guides', () => {
  it('keeps the parent of a subcategory when listing categories', async () => {
    const parentId = randomUUID()
    const now = new Date().toISOString()
    jest.spyOn(client, 'GET').mockResolvedValue({
      data: [
        {
          id: parentId,
          name: 'Tenfast',
          parentId: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: randomUUID(),
          name: 'Avtal',
          parentId,
          createdAt: now,
          updatedAt: now,
        },
      ],
      error: undefined,
      response: { ok: true, status: 200 },
    } as never)

    const result = await guidesAdapter.listCategories()

    expect(result.ok && result.data.map((c) => c.parentId)).toEqual([
      null,
      parentId,
    ])
  })
})
