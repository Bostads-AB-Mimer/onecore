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

// Imported placeholders such as "%" or "05" have no letters; they go last.
const hasLetters = (name: string) => /\p{L}/u.test(name)

export const sortModelsByName = <
  T extends { manufacturer?: string | null; modelName: string },
>(
  models: T[]
): T[] =>
  [...models].sort((a, b) => {
    const nameA = formatComponentModelName(a)
    const nameB = formatComponentModelName(b)
    const lettersFirst = Number(hasLetters(nameB)) - Number(hasLetters(nameA))
    return (
      lettersFirst ||
      nameA.localeCompare(nameB, 'sv', { numeric: true, sensitivity: 'base' })
    )
  })
