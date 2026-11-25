import { describe, expect, it } from 'vitest'

import { formatDate } from './formatting'

describe('formatDate', () => {
  it('returns a dash for a missing date', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate(undefined)).toBe('-')
  })

  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDate('2026-12-01')).toBe('2026-12-01')
  })

  it('uses the Swedish day whatever the browser timezone', () => {
    // 23:30 UTC is 00:30 the next day in Sweden (CET, UTC+1)
    expect(formatDate('2026-11-18T23:30:00Z')).toBe('2026-11-19')
    expect(formatDate(new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-19')
  })
})
