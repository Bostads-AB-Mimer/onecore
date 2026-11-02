import { describe, expect, it } from 'vitest'

import type { FieldConfig } from '../constants/entityDialogConfig'
import { cleanFormData } from './cleanFormData'

const fields: FieldConfig[] = [
  { name: 'typeName', label: 'Namn', type: 'text', required: true },
  { name: 'description', label: 'Beskrivning', type: 'text', required: false },
  {
    name: 'code',
    label: 'Ytskiktskod',
    type: 'select',
    required: false,
    nullable: true,
    options: [{ value: '', label: 'Ingen' }],
  },
]

describe('cleanFormData', () => {
  it('omits an empty optional field', () => {
    expect(
      cleanFormData(fields, { typeName: 'Vägg', description: '' })
    ).toEqual({ typeName: 'Vägg' })
  })

  it('sends null for an empty nullable field so the API clears it', () => {
    expect(cleanFormData(fields, { typeName: 'Vägg', code: '' })).toEqual({
      typeName: 'Vägg',
      code: null,
    })
  })

  it('keeps a chosen value on a nullable field', () => {
    expect(cleanFormData(fields, { code: 'WALL' })).toEqual({ code: 'WALL' })
  })

  it('keeps an empty required field for validation to catch', () => {
    expect(cleanFormData(fields, { typeName: '' })).toEqual({ typeName: '' })
  })

  it('keeps empty values on fields outside the config', () => {
    expect(cleanFormData(fields, { categoryId: '' })).toEqual({
      categoryId: '',
    })
  })
})
