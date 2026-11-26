import { describe, expect, it } from 'vitest'

import { getPageTitle } from './pageTitle'

describe('getPageTitle', () => {
  it.each([
    ['/', 'Bilplatser | ONECore'],
    ['/bilplatser', 'Bilplatser | ONECore'],
    ['/bilplatser/publicera', 'Publicera bilplatser | ONECore'],
    ['/bilplatser/123-456', 'Bilplats | ONECore'],
    ['/sok-bilplats', 'Sök bilplats | ONECore'],
    ['/materialval/utskrift', 'Materialval | ONECore'],
    ['/sokandeprofil', 'Sökandeprofil | ONECore'],
    ['/annonsinnehall/ny', 'Annonsinnehåll | ONECore'],
    ['/annonsinnehall/123/redigera', 'Annonsinnehåll | ONECore'],
    ['/omradestexter/ABC/redigera', 'Områdestexter | ONECore'],
  ])('titles %s as %s', (pathname, expected) => {
    expect(getPageTitle(pathname)).toBe(expected)
  })

  it('falls back to ONECore for an unknown path', () => {
    expect(getPageTitle('/logout')).toBe('ONECore')
  })
})
