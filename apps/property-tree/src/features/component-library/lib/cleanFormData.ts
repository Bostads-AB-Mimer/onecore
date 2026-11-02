import type { FieldConfig } from '../constants/entityDialogConfig'

export const cleanFormData = (
  fields: FieldConfig[],
  data: Record<string, unknown>
): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === '') {
      const field = fields.find((f) => f.name === key)
      if (field && !field.required) {
        if (field.nullable) cleaned[key] = null
        continue
      }
    }
    cleaned[key] = value
  }
  return cleaned
}
