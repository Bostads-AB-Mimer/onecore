import { describe, expect, it } from 'vitest'

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, parsePageSize } from './pageSize'

describe('parsePageSize', () => {
  it.each(PAGE_SIZE_OPTIONS)('accepts the option %i', (option) => {
    expect(parsePageSize(String(option))).toBe(option)
  })

  it('defaults to 100 when the URL has no page size', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(100)
    expect(parsePageSize(null)).toBe(100)
    expect(parsePageSize('')).toBe(100)
  })

  it.each(['abc', '0', '-50', '75', '1000', '250.5'])(
    'falls back to the default for %s',
    (raw) => {
      expect(parsePageSize(raw)).toBe(DEFAULT_PAGE_SIZE)
    }
  )

  it('never offers more rows than the lease search returns (limit max 500)', () => {
    expect(Math.max(...PAGE_SIZE_OPTIONS)).toBeLessThanOrEqual(500)
  })
})
