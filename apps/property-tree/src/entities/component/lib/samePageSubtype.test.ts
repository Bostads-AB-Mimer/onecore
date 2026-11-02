import { describe, expect, it } from 'vitest'

import { samePageSubtype } from './samePageSubtype'

const key = (subtypeId: string, page = 1) => [
  'instances',
  'page',
  { subtypeId, page, limit: 25 },
]

describe('samePageSubtype', () => {
  it('is true for another page of the same subtype', () => {
    expect(samePageSubtype(key('sub-1', 1), { subtypeId: 'sub-1' })).toBe(true)
  })

  it('is false for another subtype', () => {
    expect(samePageSubtype(key('sub-1'), { subtypeId: 'sub-2' })).toBe(false)
  })

  it('is false without a previous query or filter', () => {
    expect(samePageSubtype(undefined, { subtypeId: 'sub-1' })).toBe(false)
    expect(samePageSubtype(key('sub-1'), undefined)).toBe(false)
  })
})
