import assert from 'node:assert'

const mockRaw = jest.fn()
jest.mock('knex', () => () => ({ raw: mockRaw }))

import { getCostCentresByRentalObjectCodes } from '@src/services/common/adapters/xpand-db-adapter'

describe(getCostCentresByRentalObjectCodes, () => {
  beforeEach(() => {
    mockRaw.mockReset()
  })

  it('looks the codes up in one query, keyed ignoring case and trailing blanks', async () => {
    mockRaw.mockResolvedValueOnce([
      { rentalObjectCode: '306-008-01-0201  ', costCentre: '61110 ' },
      { rentalObjectCode: '705-021-03-0101', costCentre: null },
    ])

    const result = await getCostCentresByRentalObjectCodes([
      '306-008-01-0201',
      ' 306-008-01-0201 ',
      '705-021-03-0101',
      '',
    ])

    assert(result.ok)
    expect(result.data).toEqual(new Map([['306-008-01-0201', '61110']]))
    expect(mockRaw).toHaveBeenCalledTimes(1)
    const [sql, bindings] = mockRaw.mock.calls[0]
    // Duplicates and blanks are dropped before binding.
    expect(bindings).toEqual(['306-008-01-0201', '705-021-03-0101'])
    // Bound as VARCHAR placeholders, never the codes themselves.
    expect(sql).toContain(
      'VALUES (CAST(? AS VARCHAR(30))), (CAST(? AS VARCHAR(30)))'
    )
    expect(sql).not.toContain('306-008-01-0201')
  })

  it('splits more than 1000 codes into several queries', async () => {
    mockRaw.mockResolvedValue([])
    const codes = Array.from({ length: 1001 }, (_, i) => `CODE-${i}`)

    const result = await getCostCentresByRentalObjectCodes(codes)

    assert(result.ok)
    expect(mockRaw).toHaveBeenCalledTimes(2)
    expect(mockRaw.mock.calls[0][1]).toHaveLength(1000)
    expect(mockRaw.mock.calls[1][1]).toEqual(['CODE-1000'])
  })

  it('runs no query without a code that can be a rental object code', async () => {
    const result = await getCostCentresByRentalObjectCodes(['', 'X'.repeat(31)])

    assert(result.ok)
    expect(result.data.size).toBe(0)
    expect(mockRaw).not.toHaveBeenCalled()
  })
})
