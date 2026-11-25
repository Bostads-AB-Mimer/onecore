import { determineVacantFrom } from '@/rental-objects'

describe('determineVacantFrom', () => {
  const TODAY = new Date('2026-03-31T00:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(TODAY)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns the day after blockEndDate when it is in the future', () => {
    const result = determineVacantFrom(TODAY, '2026-03-01', '2026-04-15')
    expect(result).toEqual(new Date('2026-04-16T00:00:00.000Z'))
  })

  it('returns the day after blockEndDate when it is today', () => {
    const result = determineVacantFrom(TODAY, '2026-03-01', '2026-03-31')
    expect(result).toEqual(new Date('2026-04-01T00:00:00.000Z'))
  })

  it('returns undefined when blockStartDate exists but blockEndDate does not', () => {
    const result = determineVacantFrom(TODAY, '2026-03-01', null)
    expect(result).toBeUndefined()
  })

  it('returns vacantFromDate as-is when there is no block', () => {
    const result = determineVacantFrom(
      new Date('2026-03-15T00:00:00.000Z'),
      null,
      null
    )
    expect(result).toEqual(new Date('2026-03-15T00:00:00.000Z'))
  })

  it('returns undefined without a vacantFromDate: leased until further notice', () => {
    expect(determineVacantFrom(undefined, null, null)).toBeUndefined()
    expect(determineVacantFrom(null, null, null)).toBeUndefined()
  })

  it('returns undefined without a vacantFromDate whatever the block says', () => {
    expect(
      determineVacantFrom(undefined, '2026-03-01', '2026-04-15')
    ).toBeUndefined()
    expect(
      determineVacantFrom(undefined, '2026-03-01', '2026-03-20')
    ).toBeUndefined()
  })

  it('returns vacantFromDate as-is when blockEndDate is in the past', () => {
    const result = determineVacantFrom(
      new Date('2026-03-15T00:00:00.000Z'),
      '2026-03-01',
      '2026-03-20'
    )
    expect(result).toEqual(new Date('2026-03-15T00:00:00.000Z'))
  })

  it('returns vacantFromDate (today) when blockEndDate is in the past', () => {
    const result = determineVacantFrom(TODAY, '2026-03-01', '2026-03-20')
    expect(result).toEqual(new Date('2026-03-31T00:00:00.000Z'))
  })

  it('returns vacantFromDate when it is later than the day after blockEndDate', () => {
    // Block ends April 30, lease ends July 31 (vacantFromDate = Aug 1)
    // The space is still leased past the block, so Aug 1 should win
    const result = determineVacantFrom(
      new Date('2026-08-01T00:00:00.000Z'),
      '2026-03-01',
      '2026-04-30'
    )
    expect(result).toEqual(new Date('2026-08-01T00:00:00.000Z'))
  })

  it('returns day after blockEndDate when it is later than vacantFromDate', () => {
    // Block ends October 31, lease ended July 31 (vacantFromDate = Aug 1)
    // Block extends past the lease, so Nov 1 should win
    const result = determineVacantFrom(
      new Date('2026-08-01T00:00:00.000Z'),
      '2026-03-01',
      '2026-10-31'
    )
    expect(result).toEqual(new Date('2026-11-01T00:00:00.000Z'))
  })
})
