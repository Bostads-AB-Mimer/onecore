import type { ComponentModel } from '@/services/types'

import {
  formatComponentModelName,
  sortModelsByName,
} from '@/shared/lib/componentLabels'

import {
  entityDialogConfig,
  type FieldConfig,
} from '../constants/entityDialogConfig'
import type { CategoryType } from './componentRows'

const EQUIPMENT_ONLY_FIELDS = [
  'serialNumber',
  'warrantyMonths',
  'warrantyStartDate',
]

export const buildInstanceFields = (
  categoryType: CategoryType,
  models: ComponentModel[]
): FieldConfig[] => {
  const fields = entityDialogConfig.instance.fields
  if (categoryType === 'SURFACE') {
    return fields.filter((f) => !EQUIPMENT_ONLY_FIELDS.includes(f.name))
  }

  const modelField: FieldConfig = {
    name: 'modelId',
    label: 'Modell',
    type: 'select',
    required: false,
    nullable: true,
    defaultValue: '',
    options: [
      { value: '', label: 'Ingen modell' },
      ...sortModelsByName(models).map((m) => ({
        value: m.id,
        label: formatComponentModelName(m),
      })),
    ],
  }
  return [modelField, ...fields]
}

export const instanceCreateDefaults = (
  model?: ComponentModel
): Record<string, unknown> =>
  model
    ? {
        modelId: model.id,
        warrantyMonths: model.warrantyMonths || 0,
        priceAtPurchase: model.currentPrice || 0,
        depreciationPriceAtPurchase: model.subtype?.depreciationPrice || 0,
        economicLifespan: model.subtype?.economicLifespan || 0,
      }
    : {}

// The form resets the model on a move, since a model belongs to one subtype.
export const applyInstanceMove = (
  currentSubtypeId: string | undefined,
  newSubtypeId: string | undefined
): { subtypeId?: string } =>
  newSubtypeId && newSubtypeId !== currentSubtypeId
    ? { subtypeId: newSubtypeId }
    : {}
