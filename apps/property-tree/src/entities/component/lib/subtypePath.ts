import type { ComponentSubtype } from '@/services/types'

export const formatSubtypePath = (subtype: ComponentSubtype): string =>
  [
    subtype.componentType?.category?.categoryName,
    subtype.componentType?.typeName,
  ]
    .filter(Boolean)
    .join(' / ')
