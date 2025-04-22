import { Prisma } from '@prisma/client'

export const toBoolean = (value: number | null | undefined): boolean => {
  return Boolean(value)
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

    if (data instanceof Prisma.Decimal) {
      return data
    }

    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, trimStrings(value)])
    ) as T
  }

  return data
}
