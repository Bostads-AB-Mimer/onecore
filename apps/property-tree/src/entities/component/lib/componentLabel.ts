import type { Component } from '@/services/types'

export const formatComponentLabel = (component: Component): string => {
  const hierarchy = [
    component.subtype?.componentType?.category?.categoryName,
    component.subtype?.subTypeName,
  ]
    .filter(Boolean)
    .join(' - ')

  const model = component.model
  const modelPart = model
    ? [
        model.manufacturer !== 'Unknown' ? model.manufacturer : null,
        model.modelName,
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  if (hierarchy && modelPart) return `${hierarchy} (${modelPart})`
  return hierarchy || modelPart || component.serialNumber || component.id
}
