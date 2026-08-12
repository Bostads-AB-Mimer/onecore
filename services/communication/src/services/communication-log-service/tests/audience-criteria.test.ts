jest.mock('@onecore/utilities', () => ({
  logger: { info() {}, error() {}, warn() {} },
}))

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

  // The picker names this dimension in the plural (audienceObjectTypes); both
  // spellings must land as the 'objectType' criterion the search side queries.
  it('accepts objectTypes (plural) as the objectType criterion', () => {
    expect(audienceCriteriaToRows({ objectTypes: ['parkingSpace'] })).toEqual([
      { type: 'objectType', value: 'parkingSpace' },
    ])
    expect(audienceCriteriaToRows({ objectType: 'residence' })).toEqual([
      { type: 'objectType', value: 'residence' },
    ])
  })

  it('drops objectType values outside the shared vocabulary', () => {
    // 'bostad' is lease-search's dialect — storing it would make the dispatch
    // unmatchable by every object-type filter.
    const rows = audienceCriteriaToRows({
      objectType: ['bostad', 'facility', 'balgh'],
    })
    expect(rows).toEqual([{ type: 'objectType', value: 'facility' }])
  })

  it('dedupes values repeated across singular and plural keys', () => {
    const rows = audienceCriteriaToRows({
      objectType: 'other',
      objectTypes: ['other'],
    })
    expect(rows).toEqual([{ type: 'objectType', value: 'other' }])
  })
})
