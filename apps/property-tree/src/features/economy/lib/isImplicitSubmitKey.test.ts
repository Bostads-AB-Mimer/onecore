import { describe, expect, it } from 'vitest'

import { isImplicitSubmitKey } from './isImplicitSubmitKey'

describe('isImplicitSubmitKey', () => {
  it('is true for Enter in an input', () => {
    expect(isImplicitSubmitKey('Enter', 'INPUT')).toBe(true)
  })

  it('is false for Enter in a textarea, so new lines still work', () => {
    expect(isImplicitSubmitKey('Enter', 'TEXTAREA')).toBe(false)
  })

  it('is false for Enter on a button, so the send button still works', () => {
    expect(isImplicitSubmitKey('Enter', 'BUTTON')).toBe(false)
  })

  it('is false for other keys in an input', () => {
    expect(isImplicitSubmitKey('a', 'INPUT')).toBe(false)
  })
})
