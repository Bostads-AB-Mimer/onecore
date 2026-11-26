import { describe, expect, it } from 'vitest'

import type { Component } from '@/services/types'

import { isSurfaceComponent } from './componentCategory'

// The check reads only subtype.componentType.category.type; the fixtures leave
// out everything else Component and its subtype require.
const withSubtype = (subtype: unknown) =>
  ({ id: 'c1', subtype }) as unknown as Component

const withCategoryType = (type: 'SURFACE' | 'EQUIPMENT' | undefined) =>
  withSubtype({ componentType: { category: { type } } })

describe('isSurfaceComponent', () => {
  it('is true for a surface category', () => {
    expect(isSurfaceComponent(withCategoryType('SURFACE'))).toBe(true)
  })

  it('is false for an equipment category', () => {
    expect(isSurfaceComponent(withCategoryType('EQUIPMENT'))).toBe(false)
  })

  it('is false when the category has no type', () => {
    expect(isSurfaceComponent(withCategoryType(undefined))).toBe(false)
  })

  it('is false when the subtype, type or category is missing', () => {
    expect(isSurfaceComponent(withSubtype(undefined))).toBe(false)
    expect(isSurfaceComponent(withSubtype({}))).toBe(false)
    expect(isSurfaceComponent(withSubtype({ componentType: {} }))).toBe(false)
  })
})
