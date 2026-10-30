import { describe, expect, it } from 'vitest'

import { sortBySwedishName } from './sortByName'

describe('sortBySwedishName', () => {
  it('orders Å, Ä and Ö after Z and numbers numerically', () => {
    const names = ['Övrigt', 'Köksfläkt', 'Kombinerad', 'Spis 10', 'Spis 9']
    expect(sortBySwedishName(names, (n) => n)).toEqual([
      'Kombinerad',
      'Köksfläkt',
      'Spis 9',
      'Spis 10',
      'Övrigt',
    ])
  })
})
