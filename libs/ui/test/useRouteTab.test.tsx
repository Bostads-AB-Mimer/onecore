import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useRouteTab } from '../src'

const TABS = [
  { value: 'rum' },
  { value: 'kontrakt' },
  { value: 'nycklar' },
  { value: 'besiktningar', disabled: true },
] as const

const withRouter = (url: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/bostader/:rentalId/:tab?" element={children} />
        </Routes>
      </MemoryRouter>
    )
  }

const render = (url: string) =>
  renderHook(() => useRouteTab(TABS, 'rum'), { wrapper: withRouter(url) })
    .result.current

describe('useRouteTab', () => {
  it('returns the default when the segment is absent', () => {
    expect(render('/bostader/123')).toEqual({
      value: 'rum',
      basePath: '/bostader/123',
    })
  })

  it('returns the segment when it is a known tab', () => {
    expect(render('/bostader/123/nycklar')).toEqual({
      value: 'nycklar',
      basePath: '/bostader/123',
    })
  })

  it('falls back to the default for an unknown segment', () => {
    expect(render('/bostader/123/banan')).toEqual({
      value: 'rum',
      basePath: '/bostader/123',
    })
  })

  it('keeps basePath intact for a typed non-ascii segment', () => {
    expect(render('/bostader/123/sp%C3%A4rrar')).toEqual({
      value: 'rum',
      basePath: '/bostader/123',
    })
  })

  it('ignores a trailing slash on the bare url', () => {
    expect(render('/bostader/123/').basePath).toBe('/bostader/123')
  })

  it('ignores a trailing slash after the tab', () => {
    expect(render('/bostader/123/nycklar/')).toEqual({
      value: 'nycklar',
      basePath: '/bostader/123',
    })
  })

  it('treats a disabled tab like an unknown one', () => {
    expect(render('/bostader/123/besiktningar').value).toBe('rum')
  })
})
