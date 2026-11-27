import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { PropertyKvvAreaLookup } from '@/services/api/core'

import type { KvvAreasResult } from '../lib/combineKvvAreas'
import { KvvResponsibleView } from './KvvResponsibleField'

// Only the presentational view is tested; the hooks pull in baseApi, which
// reads browser globals at import time.
vi.mock('../hooks/useKvvAreaResolve', () => ({}))

const area: PropertyKvvAreaLookup = {
  kvvArea: { id: 'a1', code: 'K01', name: 'Centrum' },
  costCenter: { id: 'cc', code: '61', name: 'Distrikt Norr' },
  responsible: {
    id: 'u1',
    username: 'anan',
    firstName: 'Anna',
    lastName: 'Andersson',
    mobilePhone: '070-123',
    email: 'anna@example.com',
  },
}

const render = (props: Partial<KvvAreasResult>, withDistrict = true) =>
  renderToStaticMarkup(
    createElement(KvvResponsibleView, {
      areas: [],
      isLoading: false,
      isError: false,
      withDistrict,
      ...props,
    })
  )

describe('KvvResponsibleView', () => {
  it('shows a loading placeholder', () => {
    expect(render({ isLoading: true })).toContain('...')
  })

  it('shows "-" when the location has no KVV-area', () => {
    const html = render({ areas: [] })
    expect(html).toContain('>-<')
    expect(html).not.toContain('Kunde inte')
  })

  it('shows an error instead of "-" when the lookup failed', () => {
    const html = render({ isError: true })
    expect(html).toContain('Kunde inte hämta kvartersvärd')
    expect(html).not.toContain('>-<')
  })

  it('pairs the kvartersvärd with the area and district', () => {
    const html = render({ areas: [area] })
    expect(html).toContain('Anna Andersson – Centrum, Distrikt Norr')
    expect(html).toContain('070-123')
    expect(html).toContain('anna@example.com')
  })

  it('leaves out the district when the page already shows it', () => {
    expect(render({ areas: [area] }, false)).toContain(
      'Anna Andersson – Centrum<'
    )
  })

  it('shows "-" for an area without a kvartersvärd', () => {
    expect(
      render({
        areas: [
          {
            ...area,
            kvvArea: { ...area.kvvArea, id: 'a2' },
            responsible: null,
          },
        ],
      })
    ).toContain('- – Centrum')
  })

  it('warns on partial failure but keeps the resolved areas', () => {
    const html = render({ areas: [area], isError: true })
    expect(html).toContain('Kvartersvärd')
    expect(html).toContain('Anna Andersson')
    expect(html).toContain('Kunde inte hämta alla kvartersvärdar')
  })
})
