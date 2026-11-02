import type { Component } from '@/services/types'

import { formatComponentModelName } from '@/shared/lib/componentLabels'

export const formatComponentLabel = (component: Component): string => {
  const hierarchy = [
    component.subtype?.componentType?.category?.categoryName,
    component.subtype?.subTypeName,
  ]
    .filter(Boolean)
    .join(' - ')

  const modelPart = formatComponentModelName(component.model)

  if (hierarchy && modelPart) return `${hierarchy} (${modelPart})`
  return hierarchy || modelPart || component.serialNumber || component.id
}
