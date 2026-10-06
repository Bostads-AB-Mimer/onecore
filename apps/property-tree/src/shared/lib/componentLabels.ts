import { property } from '@onecore/types'

export const COMPONENT_CATEGORY_TYPE_LABELS: Record<
  property.ComponentCategoryType,
  string
> = {
  EQUIPMENT: 'Utrustning',
  SURFACE: 'Ytskikt',
}

export const SURFACE_CODE_LABELS: Record<property.ComponentTypeCode, string> = {
  WALL: 'Vägg',
  FLOOR: 'Golv',
  CEILING: 'Tak',
}
