import type { Component } from '@/services/types'

export const formatComponentModelName = (
  model: { manufacturer?: string | null; modelName: string } | null | undefined
): string =>
  model
    ? [
        model.manufacturer !== 'Unknown' ? model.manufacturer : null,
        model.modelName,
      ]
        .filter(Boolean)
        .join(' ')
    : ''

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
