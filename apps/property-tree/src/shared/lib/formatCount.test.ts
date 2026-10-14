import { describe, expect, it } from 'vitest'

import { formatCount } from './formatCount'

describe('formatCount', () => {
  it('uses the singular for one', () => {
    expect(formatCount(1, 'komponent', 'komponenter')).toBe('1 komponent')
  })

  it('uses the plural and Swedish digit grouping otherwise', () => {
    expect(
      formatCount(13876, 'komponent', 'komponenter').replace(/\s/g, ' ')
    ).toBe('13 876 komponenter')
    expect(formatCount(0, 'modell', 'modeller')).toBe('0 modeller')
  })
})
