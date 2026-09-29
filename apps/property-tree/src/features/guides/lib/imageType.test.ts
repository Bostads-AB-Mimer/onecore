import { describe, expect, it } from 'vitest'

import { isGuideImageType } from './imageType'

describe('isGuideImageType', () => {
  it('accepts the image types core stores', () => {
    expect(isGuideImageType('image/png')).toBe(true)
    expect(isGuideImageType('image/jpeg')).toBe(true)
    expect(isGuideImageType('image/webp')).toBe(true)
  })

  it('rejects other and empty types', () => {
    expect(isGuideImageType('image/gif')).toBe(false)
    expect(isGuideImageType('')).toBe(false)
    expect(isGuideImageType('constructor')).toBe(false)
  })
})
