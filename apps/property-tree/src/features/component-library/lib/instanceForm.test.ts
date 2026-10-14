import { describe, expect, it } from 'vitest'

import type { ComponentModel } from '@/services/types'

import {
  applyInstanceMove,
  buildInstanceFields,
  instanceCreateDefaults,
  instanceMoveFormData,
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

  it('lists the models sorted by name', () => {
    const [first] = buildInstanceFields('EQUIPMENT', [
      { ...model, id: 'm-2', manufacturer: 'Unknown', modelName: 'Z' },
      model,
    ] as ComponentModel[])
    expect(first.options?.map((o) => o.value)).toEqual(['', 'm-1', 'm-2'])
  })

  it('leaves serial number and warranty out of a surface form', () => {
    const names = buildInstanceFields('SURFACE', []).map((f) => f.name)
    expect(names).not.toContain('serialNumber')
    expect(names).not.toContain('warrantyMonths')
    expect(names).not.toContain('warrantyStartDate')
    expect(names).toContain('quantity')
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

  it('moves to the new subtype and leaves the model to the form', () => {
    expect(applyInstanceMove('sub-1', 'sub-2')).toEqual({
      subtypeId: 'sub-2',
    })
  })
})

describe('instanceMoveFormData', () => {
  const initial = {
    modelId: 'm-1',
    serialNumber: 'SN-1',
    warrantyMonths: 24,
    quantity: 1,
  }

  it('drops the model on a move to another equipment subtype', () => {
    expect(instanceMoveFormData(initial, initial, true, 'EQUIPMENT')).toEqual({
      ...initial,
      modelId: null,
    })
  })

  it('clears serial number and warranty months on a move to a surface', () => {
    expect(instanceMoveFormData(initial, initial, true, 'SURFACE')).toEqual({
      ...initial,
      modelId: null,
      serialNumber: null,
      warrantyMonths: null,
    })
  })

  it('restores the cleared fields when moved back', () => {
    const onSurface = instanceMoveFormData(initial, initial, true, 'SURFACE')
    expect(instanceMoveFormData(onSurface, initial, false, undefined)).toEqual(
      initial
    )
    expect(instanceMoveFormData(onSurface, initial, true, 'EQUIPMENT')).toEqual(
      { ...initial, modelId: null }
    )
  })

  it('keeps a serial number typed before the move', () => {
    const typed = { ...initial, serialNumber: 'SN-2' }
    expect(
      instanceMoveFormData(typed, initial, true, 'EQUIPMENT').serialNumber
    ).toBe('SN-2')
  })
})
