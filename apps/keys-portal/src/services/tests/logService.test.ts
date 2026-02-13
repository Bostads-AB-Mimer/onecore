import { describe, it, expect, vi } from 'vitest'

vi.mock('../api/core/base-api', () => ({
  GET: vi.fn(),
}))

import { mapFiltersToQuery } from '../api/logService'

describe('mapFiltersToQuery', () => {
  it('joins array filters with commas, enforces 3-char minimum on free text, and injects fields', () => {
    const result = mapFiltersToQuery(
      {
        eventType: ['CREATE', 'UPDATE'],
        objectType: ['key'],
        userName: 'admin',
        q: 'ab',
      },
      2,
      50
    )

    expect(result.eventType).toBe('CREATE,UPDATE')
    expect(result.objectType).toBe('key')
    expect(result.userName).toBe('admin')
    expect(result.page).toBe('2')
    expect(result.limit).toBe('50')
    // 'ab' is only 2 chars → below 3-char gate
    expect(result.q).toBeUndefined()
    expect(result.fields).toBeUndefined()

    // Now with 3+ chars → q and fields injected
    const result2 = mapFiltersToQuery({ q: 'abc' })
    expect(result2.q).toBe('abc')
    expect(result2.fields).toBe('userName,description,objectId')
  })
})
