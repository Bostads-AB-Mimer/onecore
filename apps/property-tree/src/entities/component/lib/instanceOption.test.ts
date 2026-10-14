import { describe, expect, it } from 'vitest'

import type { Component } from '@/services/types'

import { instanceOptionDetails, instanceOptionTitle } from './instanceOption'

const component = (c: Partial<Component>) =>
  ({
    id: 'c1',
    serialNumber: null,
    model: null,
    createdAt: '2026-05-28T10:00:00Z',
    ...c,
  }) as unknown as Component

describe('instanceOptionTitle', () => {
  it('names a component by model and serial number', () => {
    expect(
      instanceOptionTitle(
        component({
          model: { manufacturer: 'Electrolux', modelName: 'EKC6430' } as never,
          serialNumber: 'SN-123',
        })
      )
    ).toBe('Electrolux EKC6430 · SN-123')
  })

  it('falls back to the specification for a surface', () => {
    expect(
      instanceOptionTitle(component({ specifications: ' Vit, matt ' }))
    ).toBe('Vit, matt')
  })

  it('says there is no model when nothing else names the component', () => {
    expect(instanceOptionTitle(component({}))).toBe('Ingen modell')
    expect(instanceOptionTitle(component({ serialNumber: 'SN-9' }))).toBe(
      'Ingen modell · SN-9'
    )
  })
})

describe('instanceOptionDetails', () => {
  it('shows the created date and leaves out empty warranty and price', () => {
    expect(instanceOptionDetails(component({}))).toBe('Skapad 2026-05-28')
  })

  it('adds warranty and price when set', () => {
    expect(
      instanceOptionDetails(
        component({ warrantyMonths: 24, priceAtPurchase: 1200 })
      )
    ).toMatch(/^Skapad 2026-05-28 \| Garanti: 24 mån \| Pris: 1\s200 kr$/)
  })
})
