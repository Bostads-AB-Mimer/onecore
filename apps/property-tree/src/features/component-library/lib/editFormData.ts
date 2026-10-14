import type { FieldConfig } from '../constants/entityDialogConfig'

// Nulls stay out: core rejects null text and turns a null date into 1970-01-01.
export const buildEditFormData = (
  fields: FieldConfig[],
  entity: Record<string, unknown>
): Record<string, unknown> => {
  const data: Record<string, unknown> = {}
  for (const field of fields) {
    let value = entity[field.name]
    if (value === undefined || value === null) continue
    if (field.type === 'date' && typeof value === 'string') {
      value = value.split('T')[0]
    }
    data[field.name] = value
  }
  return data
}
