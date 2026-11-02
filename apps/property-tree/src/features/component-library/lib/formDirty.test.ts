import { describe, expect, it } from 'vitest'

import { isFormDirty } from './formDirty'

describe('isFormDirty', () => {
  it('is clean when nothing changed', () => {
    expect(isFormDirty({ a: 'x', b: 2 }, { a: 'x', b: 2 })).toBe(false)
  })

  it('treats empty string, null and missing as the same', () => {
    expect(isFormDirty({ a: null }, { a: '', b: undefined })).toBe(false)
  })

  it('notices a changed or added value', () => {
    expect(isFormDirty({ a: 'x' }, { a: 'y' })).toBe(true)
    expect(isFormDirty({}, { a: 'y' })).toBe(true)
  })
})
