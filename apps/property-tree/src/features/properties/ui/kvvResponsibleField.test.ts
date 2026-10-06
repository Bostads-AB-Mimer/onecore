// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { formatResponsible } from './KvvResponsibleField'

describe('formatResponsible', () => {
  it('joins first and last name', () => {
    expect(
      formatResponsible({
        id: '1',
        username: 'abc',
        firstName: 'Eva',
        lastName: 'Ek',
      })
    ).toBe('Eva Ek')
  })

  it('falls back to username when no name is set', () => {
    expect(formatResponsible({ id: '1', username: 'abc' })).toBe('abc')
  })
})
