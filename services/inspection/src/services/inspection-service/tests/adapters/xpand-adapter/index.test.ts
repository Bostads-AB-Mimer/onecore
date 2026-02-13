import {
  XpandDbInspectionFactory,
  XpandDbDetailedInspectionFactory,
  XpandDbDetailedInspectionRemarkFactory,
} from '../../factories'

let mockThen: jest.Mock

jest.mock('knex', () => {
  mockThen = jest.fn()

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    first: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    clearSelect: jest.fn().mockReturnThis(),
    clearOrder: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
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

jest.mock('../../../adapters/xpand-adapter/utils', () => {
  const actual = jest.requireActual('../../../adapters/xpand-adapter/utils')
  return {
    ...actual,
    // Keep convertNumericBooleans behavior but noop trimStrings for simplicity
    trimStrings: jest.fn(<T>(data: T) => data),
  }
})

import * as xpandAdapter from '../../../adapters/xpand-adapter'

describe(xpandAdapter.getInspections, () => {
  beforeEach(() => {
    mockThen.mockClear()
  })

  it('should map all status codes correctly', async () => {
    const inspections = [
      XpandDbInspectionFactory.build({ id: 'INS001', status: 0 }),
      XpandDbInspectionFactory.build({ id: 'INS002', status: 1 }),
      XpandDbInspectionFactory.build({ id: 'INS003', status: 3 }),
      XpandDbInspectionFactory.build({ id: 'INS004', status: 6 }),
    ]
    // First call for count
    mockThen.mockImplementationOnce((callback) =>
      callback({ count: inspections.length })
    )
    // Second call for data
    mockThen.mockImplementationOnce((callback) => callback(inspections))

    const result = await xpandAdapter.getInspections()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.inspections).toHaveLength(4)
      expect(result.data.inspections[0].status).toBe('Registrerad')
      expect(result.data.inspections[1].status).toBe('Genomförd')
      expect(result.data.inspections[2].status).toBe(
        'Besiktningsresultat skickat'
      )
      expect(result.data.inspections[3].status).toBe('Makulerad')
      expect(result.data.totalRecords).toBe(4)
    }
  })

  it('should handle unknown status codes with fallback message', async () => {
    const inspections = [
      XpandDbInspectionFactory.build({ id: 'INS005', status: 99 }),
    ]
    mockThen.mockImplementationOnce((callback) =>
      callback({ count: inspections.length })
    )
    mockThen.mockImplementationOnce((callback) => callback(inspections))

    const result = await xpandAdapter.getInspections()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.inspections[0].status).toBe('Unknown (99)')
    }
  })

  it('should return empty array for empty database result', async () => {
    mockThen.mockImplementationOnce((callback) => callback({ count: 0 }))
    mockThen.mockImplementationOnce((callback) => callback([]))

    const result = await xpandAdapter.getInspections()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.inspections).toEqual([])
      expect(result.data.totalRecords).toBe(0)
    }
  })

  it('should return schema-error when validation fails', async () => {
    const invalidInspections = [
      XpandDbInspectionFactory.build({ date: 'invalid-date' as any }),
    ]
    mockThen.mockImplementationOnce((callback) => callback({ count: 1 }))
    mockThen.mockImplementationOnce((callback) => callback(invalidInspections))

    const result = await xpandAdapter.getInspections()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('schema-error')
    }
  })
})

describe(xpandAdapter.getInspectionsByResidenceId, () => {
  const residenceId = 'RES001'

  beforeEach(() => {
    mockThen.mockClear()
  })

  it('should fetch inspections filtered by residenceId', async () => {
    mockThen.mockImplementationOnce((callback) =>
      callback([
        XpandDbInspectionFactory.build({ id: 'INS001', status: 1 }),
        XpandDbInspectionFactory.build({ id: 'INS002', status: 0 }),
      ])
    )

    const result = await xpandAdapter.getInspectionsByResidenceId(residenceId)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0].id).toBe('INS001')
      expect(result.data[1].id).toBe('INS002')
    }
  })
})

describe(xpandAdapter.getInspectionById, () => {
  const inspectionId = 'INS001'

  beforeEach(() => {
    mockThen.mockClear()
  })

  it('should return detailed inspection when found', async () => {
    mockThen
      .mockImplementationOnce((callback) =>
        callback(
          XpandDbDetailedInspectionFactory.build({
            id: inspectionId,
            status: 1,
          })
        )
      )
      .mockImplementationOnce((callback) =>
        callback([
          XpandDbDetailedInspectionRemarkFactory.build({
            remarkId: 'REMARK001',
            location: 'Kitchen',
          }),
        ])
      )

    const result = await xpandAdapter.getInspectionById(inspectionId)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe(inspectionId)
      expect(result.data.remarkCount).toBe(1)
      expect(result.data.rooms).toHaveLength(1)
      expect(result.data.rooms[0].remarks).toHaveLength(1)
      expect(result.data.rooms[0].remarks[0].remarkId).toBe('REMARK001')
    }
  })

  it('should return not-found when inspection does not exist', async () => {
    mockThen.mockImplementationOnce((callback) => callback(undefined))

    const result = await xpandAdapter.getInspectionById(inspectionId)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('not-found')
    }
  })

  it('should return schema-error when detailed inspection validation fails', async () => {
    mockThen
      .mockImplementationOnce((callback) =>
        callback(
          XpandDbDetailedInspectionFactory.build({
            id: inspectionId,
            status: 1,
          })
        )
      )
      .mockImplementationOnce((callback) =>
        callback([
          XpandDbDetailedInspectionRemarkFactory.build({
            remarkGrade: 'invalid-grade' as any,
          }),
        ])
      )

    const result = await xpandAdapter.getInspectionById(inspectionId)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('schema-error')
    }
  })

  it('should handle database errors gracefully', async () => {
    mockThen.mockImplementationOnce(() => {
      throw new Error('Database connection failed')
    })

    const result = await xpandAdapter.getInspectionById(inspectionId)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })
})
