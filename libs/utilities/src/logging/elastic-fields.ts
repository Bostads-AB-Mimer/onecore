type Scalar = string | number | boolean | null

// `true` keeps a scalar value; a nested shape keeps that object's listed fields.
type FieldShape = { [field: string]: true | FieldShape }

// The shared logging index is capped at 1000 mapped fields. error.type is left
// out because the current index has no mapping for it and is full.
const ELASTIC_OBJECT_FIELDS: FieldShape = {
  application: { name: true, environment: true },
  request: {
    path: true,
    method: true,
    ip: true,
    status: true,
    user: { id: true, username: true },
  },
  err: { type: true, message: true, stack: true, code: true, status: true },
  error: { message: true, stack: true, code: true, status: true },
}

const isScalar = (value: unknown): value is Scalar =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pickShape = (
  value: Record<string, unknown>,
  shape: FieldShape
): Record<string, unknown> | undefined => {
  const result: Record<string, unknown> = {}
  for (const [field, fieldShape] of Object.entries(shape)) {
    const fieldValue = value[field]
    if (fieldShape === true) {
      if (isScalar(fieldValue)) result[field] = fieldValue
    } else if (isPlainObject(fieldValue)) {
      const picked = pickShape(fieldValue, fieldShape)
      if (picked) result[field] = picked
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export const toElasticDocument = (
  doc: Record<string, unknown>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(doc)) {
    if (isScalar(value)) {
      result[field] = value
    } else if (Array.isArray(value)) {
      if (value.every(isScalar)) result[field] = value
    } else if (isPlainObject(value)) {
      const shape = ELASTIC_OBJECT_FIELDS[field]
      if (shape && shape !== true) {
        const picked = pickShape(value, shape)
        if (picked) result[field] = picked
      }
    }
  }
  return result
}

export const toElasticLine = (line: string): string => {
  let doc: unknown
  try {
    doc = JSON.parse(line)
  } catch {
    return line
  }
  if (!isPlainObject(doc)) return line
  return JSON.stringify(toElasticDocument(doc)) + '\n'
}
