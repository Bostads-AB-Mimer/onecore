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

const modelNameCollator = new Intl.Collator('sv', {
  numeric: true,
  sensitivity: 'base',
})

export const sortModelsByName = <
  T extends { manufacturer?: string | null; modelName: string },
>(
  models: T[],
  label: (model: T) => string = formatComponentModelName
): T[] =>
  models
    .map((model) => {
      const name = label(model)
      return { model, name, lettered: hasLetters(name) }
    })
    .sort(
      (a, b) =>
        Number(b.lettered) - Number(a.lettered) ||
        modelNameCollator.compare(a.name, b.name)
    )
    .map(({ model }) => model)
