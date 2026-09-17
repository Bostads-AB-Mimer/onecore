import { describe, expect, it } from 'vitest'

import {
  expandInvalidBlocks,
  hasInvalidBlock,
  isInvalidBlock,
  toApiBlocks,
} from './contentBlocks'

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

describe('expandInvalidBlocks', () => {
  it('expands collapsed invalid blocks and leaves valid ones collapsed', () => {
    const blocks = expandInvalidBlocks([
      { id: '1', type: 'headline', content: 'Rubrik', collapsed: true },
      { id: '2', type: 'text', content: '', collapsed: true },
      { id: '3', type: 'link', name: '', url: '', collapsed: false },
    ])

    expect(blocks.map((block) => block.collapsed)).toEqual([true, false, false])
  })
})

describe('toApiBlocks', () => {
  it('strips the UI-only collapsed flag', () => {
    expect(
      toApiBlocks([
        { id: '1', type: 'text', content: 'Hej', collapsed: true },
        {
          id: '2',
          type: 'link',
          name: 'A',
          url: 'https://a.se',
          collapsed: true,
        },
      ])
    ).toEqual([
      { type: 'text', content: 'Hej' },
      { type: 'link', name: 'A', url: 'https://a.se' },
    ])
  })
})
