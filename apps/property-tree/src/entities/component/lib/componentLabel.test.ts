import { describe, expect, it } from 'vitest'

import type { Component } from '@/services/types'

import {
  formatComponentLabel,
  formatComponentModelName,
} from './componentLabel'

const component = (c: Partial<Component>) =>
  ({ id: 'c1', serialNumber: null, ...c }) as unknown as Component

describe('formatComponentLabel', () => {
  it('names a surface by category and subtype', () => {
    expect(
      formatComponentLabel(
        component({
          subtype: {
            subTypeName: 'Målning väggar',
            componentType: { category: { categoryName: 'Ytskikt' } },
          } as never,
        })
      )
    ).toBe('Ytskikt - Målning väggar')
  })

  it('adds the model for an appliance and hides an Unknown manufacturer', () => {
    expect(
      formatComponentLabel(
        component({
          subtype: {
            subTypeName: 'Diskmaskin 60 cm',
            componentType: { category: { categoryName: 'Vitvaror' } },
          } as never,
          model: { manufacturer: 'Unknown', modelName: 'ESF5555' } as never,
        })
      )
    ).toBe('Vitvaror - Diskmaskin 60 cm (ESF5555)')
  })

  it('has no dangling separator when the category is missing', () => {
    expect(
      formatComponentLabel(
        component({ subtype: { subTypeName: 'Kakel' } as never })
      )
    ).toBe('Kakel')
  })

  it('falls back to serial number, then id', () => {
    expect(formatComponentLabel(component({ serialNumber: '4711' }))).toBe(
      '4711'
    )
    expect(formatComponentLabel(component({}))).toBe('c1')
  })
})

describe('formatComponentModelName', () => {
  it('joins manufacturer and model name', () => {
    expect(
      formatComponentModelName({
        manufacturer: 'Electrolux',
        modelName: 'LKI6200S2W',
      })
    ).toBe('Electrolux LKI6200S2W')
  })

  it('leaves out the placeholder manufacturer', () => {
    expect(
      formatComponentModelName({
        manufacturer: 'Unknown',
        modelName: 'Okänd modell',
      })
    ).toBe('Okänd modell')
  })

  it('returns an empty string without a model', () => {
    expect(formatComponentModelName(null)).toBe('')
  })
})
