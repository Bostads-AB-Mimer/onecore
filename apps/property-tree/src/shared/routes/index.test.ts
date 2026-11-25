import { matchRoutes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { paths, routes } from './index'

// The guide routes in the order app/router.tsx lists them.
const guideRoutes = [
  { path: routes.guides, id: 'guides' },
  { path: routes.guideNew, id: 'guideNew' },
  { path: routes.guide, id: 'guide' },
  { path: routes.guideEdit, id: 'guideEdit' },
  { path: routes.guideCategory, id: 'guideCategory' },
]

const matchedId = (pathname: string) =>
  matchRoutes(guideRoutes, pathname)?.at(-1)?.route.id

describe('guide routes', () => {
  it('builds the category path', () => {
    expect(paths.guideCategory('abc-123')).toBe('/guider/kategori/abc-123')
  })

  it('routes a category link to the category page', () => {
    expect(matchedId(paths.guideCategory('abc-123'))).toBe('guideCategory')
  })

  it('still routes guide slugs to the guide pages', () => {
    expect(matchedId(paths.guide('skapa-hyresobjekt'))).toBe('guide')
    expect(matchedId(paths.guideEdit('skapa-hyresobjekt'))).toBe('guideEdit')
  })
})
