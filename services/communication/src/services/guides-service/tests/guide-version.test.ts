import { isSameUpdatedAt, nextUpdatedAt } from '../adapters/guide-version'

describe('nextUpdatedAt', () => {
  it('uses the current time when it is after the previous value', () => {
    const previous = new Date('2026-09-23T10:00:00.000Z')
    const now = new Date('2026-09-23T10:00:05.123Z')
    expect(nextUpdatedAt(previous, now)).toEqual(now)
  })

  it('moves at least one millisecond forward within the same millisecond', () => {
    const previous = new Date('2026-09-23T10:00:00.123Z')
    expect(nextUpdatedAt(previous, previous).toISOString()).toBe(
      '2026-09-23T10:00:00.124Z'
    )
  })

  it('moves forward even when the clock lags the stored value', () => {
    const previous = new Date('2026-09-23T10:00:00.500Z')
    const now = new Date('2026-09-23T10:00:00.100Z')
    expect(nextUpdatedAt(previous, now).toISOString()).toBe(
      '2026-09-23T10:00:00.501Z'
    )
  })
})

describe('isSameUpdatedAt', () => {
  it('matches the ISO string of the stored value', () => {
    const stored = new Date('2026-09-23T10:00:00.123Z')
    expect(isSameUpdatedAt(stored, stored.toISOString())).toBe(true)
  })

  it('does not match a different millisecond', () => {
    const stored = new Date('2026-09-23T10:00:00.123Z')
    expect(isSameUpdatedAt(stored, '2026-09-23T10:00:00.122Z')).toBe(false)
  })
})
