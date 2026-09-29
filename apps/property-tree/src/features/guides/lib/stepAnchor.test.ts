import { describe, expect, it } from 'vitest'

import { guideLink, stepAnchorId, stepNumberFromHash } from './stepAnchor'

describe('step anchors', () => {
  it('builds and parses step anchors', () => {
    expect(stepAnchorId(3)).toBe('steg-3')
    expect(stepNumberFromHash('#steg-3')).toBe(3)
    expect(stepNumberFromHash('#annat')).toBeNull()
    expect(stepNumberFromHash('')).toBeNull()
  })

  it('builds guide links with an optional step', () => {
    expect(guideLink('uppsagning')).toBe('/guider/uppsagning')
    expect(guideLink('uppsagning', 2)).toBe('/guider/uppsagning#steg-2')
  })
})
