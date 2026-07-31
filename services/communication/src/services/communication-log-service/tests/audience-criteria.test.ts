import { audienceCriteriaToRows } from '../audience-criteria'

describe('audienceCriteriaToRows', () => {
  it('returns [] for undefined / empty', () => {
    expect(audienceCriteriaToRows(undefined)).toEqual([])
    expect(audienceCriteriaToRows({})).toEqual([])
  })

  it('fans out whitelisted array keys into one row per value', () => {
    const rows = audienceCriteriaToRows({
      buildingCodes: ['B12', 'B13'],
      status: ['0'],
    })
    expect(rows).toEqual([
      { type: 'buildingCodes', value: 'B12' },
      { type: 'buildingCodes', value: 'B13' },
      { type: 'status', value: '0' },
    ])
  })

  it('coerces scalars to strings and ignores unknown / empty values', () => {
    const rows = audienceCriteriaToRows({
      districtNames: 'Väster',
      page: 3,
      q: 'ignored-free-text',
      buildingCodes: [''],
    })
    expect(rows).toEqual([{ type: 'districtNames', value: 'Väster' }])
  })
})
