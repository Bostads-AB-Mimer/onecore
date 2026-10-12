import { describe, expect, it } from 'vitest'

import type { ComponentModel } from '@/services/types'

import {
  applyInstanceMove,
  buildInstanceFields,
  instanceCreateDefaults,
} from './instanceForm'

const model = {
  id: 'm-1',
  manufacturer: 'Electrolux',
  modelName: 'LKI6200S2W',
  warrantyMonths: 24,
  currentPrice: 8000,
  subtype: { depreciationPrice: 6000, economicLifespan: 15 },
} as unknown as ComponentModel

describe('buildInstanceFields', () => {
  it('puts an optional model select first for equipment', () => {
    const [first] = buildInstanceFields('EQUIPMENT', [model])
    expect(first).toEqual({
      name: 'modelId',
      label: 'Modell',
      type: 'select',
      required: false,
      nullable: true,
      defaultValue: '',
      options: [
        { value: '', label: 'Ingen modell' },
        { value: 'm-1', label: 'Electrolux LKI6200S2W' },
      ],
    })
  })

  it('has no model field for surfaces', () => {
    expect(
      buildInstanceFields('SURFACE', [model]).some((f) => f.name === 'modelId')
    ).toBe(false)
  })

  it('does not require a serial number and clears it when emptied', () => {
    const serial = buildInstanceFields('EQUIPMENT', []).find(
      (f) => f.name === 'serialNumber'
    )
    expect(serial).toMatchObject({ required: false, nullable: true })
  })
})

describe('instanceCreateDefaults', () => {
  it('is empty without a model', () => {
    expect(instanceCreateDefaults()).toEqual({})
  })

  it('takes the model and its prices', () => {
    expect(instanceCreateDefaults(model)).toEqual({
      modelId: 'm-1',
      warrantyMonths: 24,
      priceAtPurchase: 8000,
      depreciationPriceAtPurchase: 6000,
      economicLifespan: 15,
    })
  })
})

describe('applyInstanceMove', () => {
  it('changes nothing when the subtype is unchanged', () => {
    expect(applyInstanceMove('sub-1', 'sub-1')).toEqual({})
  })

  it('changes nothing when no subtype was picked', () => {
    expect(applyInstanceMove('sub-1', undefined)).toEqual({})
  })

  it('moves to the new subtype and drops the model', () => {
    expect(applyInstanceMove('sub-1', 'sub-2')).toEqual({
      subtypeId: 'sub-2',
      modelId: null,
    })
  })
})
