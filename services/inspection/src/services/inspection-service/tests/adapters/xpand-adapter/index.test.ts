import { XpandDbInspectionFactory } from '../../factories'

let mockThen: jest.Mock

jest.mock('knex', () => {
  mockThen = jest.fn()

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: mockThen,
  }

  return () => {
    const knexInstance = jest.fn(() => mockQueryBuilder)
    Object.assign(knexInstance, mockQueryBuilder)
    return knexInstance
  }
})

jest.mock('@onecore/utilities', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('../../../adapters/xpand-adapter/utils', () => ({
  trimStrings: jest.fn(<T>(data: T) => data),
}))

import * as xpandAdapter from '../../../adapters/xpand-adapter'

describe(xpandAdapter.getInspectionsFromXpand, () => {
  beforeEach(() => {
    mockThen.mockClear()
  })

  it('should map all status codes correctly', async () => {
    mockThen.mockImplementationOnce((callback) =>
      callback([
        XpandDbInspectionFactory.build({ id: 'INS001', status: 0 }),
        XpandDbInspectionFactory.build({ id: 'INS002', status: 1 }),
        XpandDbInspectionFactory.build({ id: 'INS003', status: 3 }),
        XpandDbInspectionFactory.build({ id: 'INS004', status: 6 }),
      ])
    )

    const result = await xpandAdapter.getInspectionsFromXpand()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(4)
      expect(result.data[0].status).toBe('Registrerad')
      expect(result.data[1].status).toBe('Genomförd')
      expect(result.data[2].status).toBe('Besiktningsresultat skickat')
      expect(result.data[3].status).toBe('Makulerad')
    }
  })

  it('should handle unknown status codes with fallback message', async () => {
    mockThen.mockImplementationOnce((callback) =>
      callback([XpandDbInspectionFactory.build({ id: 'INS005', status: 99 })])
    )

    const result = await xpandAdapter.getInspectionsFromXpand()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0].status).toBe('Unknown (99)')
    }
  })

  it('should return empty array for empty database result', async () => {
    mockThen.mockImplementationOnce((callback) => callback([]))

    const result = await xpandAdapter.getInspectionsFromXpand()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual([])
    }
  })

  it('should return schema-error when validation fails', async () => {
    mockThen.mockImplementationOnce((callback) =>
      callback([XpandDbInspectionFactory.build({ date: 'invalid-date' as any })])
    )

    const result = await xpandAdapter.getInspectionsFromXpand()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('schema-error')
    }
  })
})
