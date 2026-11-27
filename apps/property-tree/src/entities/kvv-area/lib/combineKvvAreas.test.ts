import { describe, expect, it } from 'vitest'

import type { PropertyKvvAreaLookup } from '@/services/api/core'

import { combineKvvAreas } from './combineKvvAreas'

const lookup = (id: string): PropertyKvvAreaLookup => ({
  kvvArea: { id, code: id, name: `Område ${id}` },
  costCenter: { id: 'cc', code: 'cc', name: 'Distrikt Norr' },
  responsible: null,
})

const ok = (data: PropertyKvvAreaLookup | null) => ({
  data,
  isLoading: false,
  isError: false,
})

describe('combineKvvAreas', () => {
  it('dedupes by KVV-area and keeps the property default first', () => {
    const result = combineKvvAreas([
      ok(lookup('default')),
      ok(lookup('default')),
      ok(lookup('exception')),
      ok(lookup('default')),
    ])

    expect(result.areas.map((a) => a.kvvArea.id)).toEqual([
      'default',
      'exception',
    ])
    expect(result.isError).toBe(false)
  })

  it('skips locations without a KVV-area', () => {
    expect(combineKvvAreas([ok(null), ok(null)]).areas).toEqual([])
  })

  it('keeps the resolved areas and flags the error on partial failure', () => {
    const result = combineKvvAreas([
      ok(lookup('default')),
      { data: undefined, isLoading: false, isError: true },
    ])

    expect(result.areas.map((a) => a.kvvArea.id)).toEqual(['default'])
    expect(result.isError).toBe(true)
  })

  it('is loading while any lookup is loading', () => {
    const result = combineKvvAreas([
      ok(lookup('default')),
      { data: undefined, isLoading: true, isError: false },
    ])

    expect(result.isLoading).toBe(true)
  })
})
