import { describe, it, expect } from 'vitest'

import { toReturnPath } from './returnPath'

describe('toReturnPath', () => {
  it.each([
    '/\\evil.example',
    '//evil.example',
    'https://evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\\[',
    'javascript:alert(1)',
    'evil.example',
    '',
  ])('falls back to / for %j', (state) => {
    expect(toReturnPath(state)).toBe('/')
  })

  it('falls back to / when state is missing', () => {
    expect(toReturnPath(null)).toBe('/')
  })

  it.each(['/', '/KeyLoans', '/KeyLoans?tab=active#top'])(
    'keeps internal path %j',
    (state) => {
      expect(toReturnPath(state)).toBe(state)
    }
  )
})
