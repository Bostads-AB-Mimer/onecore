import { describe, expect, it } from 'vitest'

import { hasInvalidBlock, isInvalidBlock } from './contentBlocks'

describe('isInvalidBlock', () => {
  it('flags an empty text block', () => {
    expect(isInvalidBlock({ id: '1', type: 'text', content: '' })).toBe(true)
    expect(isInvalidBlock({ id: '1', type: 'headline' })).toBe(true)
  })

  it('flags a whitespace-only text block', () => {
    expect(isInvalidBlock({ id: '1', type: 'text', content: '  \n ' })).toBe(
      true
    )
  })

  it('accepts a text block with content', () => {
    expect(isInvalidBlock({ id: '1', type: 'text', content: 'Hej' })).toBe(
      false
    )
  })

  it('flags a link block missing name or url', () => {
    expect(
      isInvalidBlock({ id: '1', type: 'link', name: '', url: 'https://a.se' })
    ).toBe(true)
    expect(
      isInvalidBlock({ id: '1', type: 'link', name: 'Visning', url: '' })
    ).toBe(true)
  })

  it('flags a link block with an invalid url', () => {
    expect(
      isInvalidBlock({
        id: '1',
        type: 'link',
        name: 'Visning',
        url: 'inte-url',
      })
    ).toBe(true)
  })

  it('accepts a complete link block', () => {
    expect(
      isInvalidBlock({
        id: '1',
        type: 'link',
        name: 'Visning',
        url: 'https://a.se/visning',
      })
    ).toBe(false)
  })
})

describe('hasInvalidBlock', () => {
  it('is false when every block is valid', () => {
    expect(
      hasInvalidBlock([
        { id: '1', type: 'headline', content: 'Rubrik' },
        { id: '2', type: 'link', name: 'A', url: 'https://a.se' },
      ])
    ).toBe(false)
  })

  it('is true when any block is invalid', () => {
    expect(
      hasInvalidBlock([
        { id: '1', type: 'headline', content: 'Rubrik' },
        { id: '2', type: 'text', content: '' },
      ])
    ).toBe(true)
  })
})
