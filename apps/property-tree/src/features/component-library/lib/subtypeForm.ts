import { sortBySwedishName } from '@/shared/lib/sortByName'

import {
  entityDialogConfig,
  type FieldConfig,
} from '../constants/entityDialogConfig'

export const subtypeNamePlaceholder = (siblingNames: string[]): string => {
  const examples = sortBySwedishName(
    siblingNames.filter((name) => name.trim()),
    (name) => name
  ).slice(0, 2)
  return examples.length > 0
    ? `T.ex. ${examples.join(', ')}`
    : 'Namn på undertypen'
}

export const buildSubtypeFields = (siblingNames: string[]): FieldConfig[] =>
  entityDialogConfig.subtype.fields.map((field) =>
    field.name === 'subTypeName'
      ? { ...field, placeholder: subtypeNamePlaceholder(siblingNames) }
      : field
  )
