import type { Component } from '@/services/types'

import { libraryHref } from './libraryTree'

export const componentLibraryHref = (component: Component): string | null => {
  const subtype = component.subtype
  const type = subtype?.componentType
  const category = type?.category
  if (!subtype || !type || !category) return null

  const href = libraryHref({
    level: 'subtype',
    categoryId: category.id,
    categoryName: category.categoryName,
    typeId: type.id,
    typeName: type.typeName,
    subtypeId: subtype.id,
    subtypeName: subtype.subTypeName,
    tab: 'components',
    ...(component.model?.id && { modelId: component.model.id }),
  })
  return `${href}&componentId=${encodeURIComponent(component.id)}`
}

export const markedComponentUrl = (currentUrl: string, componentId: string) => {
  const url = new URL(currentUrl)
  url.searchParams.set('componentId', componentId)
  return url.toString()
}
