import { describe, expect, it } from 'vitest'

import type { FieldConfig } from '../constants/entityDialogConfig'
import { buildEditFormData } from './editFormData'

const field = (name: string, type: FieldConfig['type']): FieldConfig => ({
  name,
  label: name,
  type,
  required: false,
})

const fields = [
  field('serialNumber', 'text'),
  field('specifications', 'textarea'),
  field('warrantyStartDate', 'date'),
  field('warrantyMonths', 'number'),
  field('modelId', 'select'),
]

describe('buildEditFormData', () => {
  it('leaves out null values so an imported component saves without them', () => {
    expect(
      buildEditFormData(fields, {
        id: 'c1',
        serialNumber: null,
        specifications: null,
        warrantyStartDate: null,
        warrantyMonths: null,
        modelId: null,
      })
    ).toEqual({})
  })

  it('copies set values and cuts ISO dates to the day', () => {
    expect(
      buildEditFormData(fields, {
        serialNumber: '24100107',
        specifications: 'Vit',
        warrantyStartDate: '2021-03-14T00:00:00.000Z',
        warrantyMonths: 0,
        modelId: 'm-1',
      })
    ).toEqual({
      serialNumber: '24100107',
      specifications: 'Vit',
      warrantyStartDate: '2021-03-14',
      warrantyMonths: 0,
      modelId: 'm-1',
    })
  })

  it('ignores fields the form does not have', () => {
    expect(
      buildEditFormData(fields, { id: 'c1', createdAt: '2020-01-01' })
    ).toEqual({})
  })
})
