const STATUS_MAP: Record<number, string> = {
  0: 'Registrerad',
  1: 'Genomförd',
  3: 'Besiktningsresultat skickat',
  6: 'Makulerad',
} as const

export function mapInspectionStatus(
  inspections: Array<{ status: number; [key: string]: any }>
): Array<{ status: string; [key: string]: any }> {
  return inspections.map((inspection) => ({
    ...inspection,
    status:
      STATUS_MAP[inspection.status as number] ??
      `Unknown (${inspection.status})`,
  }))
}

export function trimStrings<T>(data: T): T {
  if (typeof data === 'string') {
    return data.trim() as T
  }

  if (Array.isArray(data)) {
    return data.map(trimStrings) as T
  }

  if (data !== null && typeof data === 'object') {
    if (data instanceof Date) {
      return data
    }

    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, trimStrings(value)])
    ) as T
  }

  return data
}

/**
 * Converts numeric boolean fields (0/1) to actual booleans.
 * Specify which fields should be converted using the fields parameter.
 */
export function convertNumericBooleans<T extends Record<string, any>>(
  data: T,
  fields: (keyof T)[]
): T {
  const converted = { ...data }
  for (const field of fields) {
    if (field in converted) {
      converted[field] = Boolean(converted[field]) as any
    }
  }
  return converted
}
