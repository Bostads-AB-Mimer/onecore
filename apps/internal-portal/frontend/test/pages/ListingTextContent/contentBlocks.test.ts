import { describe, expect, it } from 'vitest'

import {
  isInvalidBlock,
  isValidUrl,
} from '@/pages/ListingTextContent/utils/contentBlocks'

describe('isValidUrl', () => {
  it('accepts an empty value so missing and malformed can be flagged apart', () => {
    expect(isValidUrl('')).toBe(true)
    expect(isValidUrl('   ')).toBe(true)
  })

  it('accepts absolute URLs and rejects malformed ones', () => {
    expect(isValidUrl('https://mimer.nu/x')).toBe(true)
    expect(isValidUrl('mimer.nu')).toBe(false)
  })
})

describe('isInvalidBlock', () => {
  it('flags text blocks without content', () => {
    expect(isInvalidBlock({ id: 'a', type: 'text', content: '  ' })).toBe(true)
    expect(isInvalidBlock({ id: 'a', type: 'text', content: 'x' })).toBe(false)
  })

  it('flags link blocks missing a name or a valid URL', () => {
    const link = { id: 'a', type: 'link' as const, name: 'Mimer' }
    expect(isInvalidBlock({ ...link, url: '' })).toBe(true)
    expect(isInvalidBlock({ ...link, url: 'mimer.nu' })).toBe(true)
    expect(isInvalidBlock({ ...link, name: '', url: 'https://mimer.nu' })).toBe(
      true
    )
    expect(isInvalidBlock({ ...link, url: 'https://mimer.nu' })).toBe(false)
  })
})
