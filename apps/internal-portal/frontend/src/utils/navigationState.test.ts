import { describe, expect, it } from 'vitest'

import { currentPath, getReturnTo } from './navigationState'

describe('currentPath', () => {
  it('joins pathname and search', () => {
    expect(currentPath({ pathname: '/bilplatser', search: '?tab=1' })).toBe(
      '/bilplatser?tab=1'
    )
  })

  it('returns only the pathname when there is no search', () => {
    expect(currentPath({ pathname: '/bilplatser', search: '' })).toBe(
      '/bilplatser'
    )
  })
})

describe('getReturnTo', () => {
  it('returns the stored origin', () => {
    expect(getReturnTo({ from: '/bilplatser?tab=1' }, '/fallback')).toBe(
      '/bilplatser?tab=1'
    )
  })

  it('falls back when state is missing', () => {
    expect(getReturnTo(null, '/fallback')).toBe('/fallback')
    expect(getReturnTo(undefined, '/fallback')).toBe('/fallback')
  })

  it('falls back when state has no origin', () => {
    expect(getReturnTo({}, '/fallback')).toBe('/fallback')
    expect(getReturnTo({ from: '' }, '/fallback')).toBe('/fallback')
    expect(getReturnTo({ from: 42 }, '/fallback')).toBe('/fallback')
  })

  it('falls back when the origin is not an in-app path', () => {
    expect(getReturnTo({ from: 'https://evil.example' }, '/fallback')).toBe(
      '/fallback'
    )
  })
})
