import type {
  ComponentCategory,
  ComponentSubtype,
  ComponentType,
} from '@/services/types'

import type { CategoryType } from './componentRows'

export const COMPONENT_PAGE_SIZE = 25

// The model filter's URL value for components without a model.
export const NO_MODEL = 'none'

export type SubtypeTab = 'components' | 'models'

export type ViewState =
  | { level: 'categories' }
  | { level: 'types'; categoryId: string; categoryName: string }
  | {
      level: 'subtypes'
      categoryId: string
      categoryName: string
      typeId: string
      typeName: string
    }
  | {
      level: 'subtype'
      categoryId: string
      categoryName: string
      typeId: string
      typeName: string
      subtypeId: string
      subtypeName: string
      tab: SubtypeTab
      modelId?: string
    }

export type SubtypeViewState = Extract<ViewState, { level: 'subtype' }>

const LEGACY_LEVELS = ['models', 'instances']

export const isLegacyLibraryUrl = (params: URLSearchParams): boolean =>
  LEGACY_LEVELS.includes(params.get('level') ?? '')

export const parseViewState = (params: URLSearchParams): ViewState => {
  const level = params.get('level') ?? 'categories'
  const categoryId = params.get('categoryId')
  const categoryName = params.get('categoryName')
  const typeId = params.get('typeId')
  const typeName = params.get('typeName')
  const subtypeId = params.get('subtypeId')
  const subtypeName = params.get('subtypeName')

  if (!categoryId || !categoryName) return { level: 'categories' }
  if (level === 'types') return { level: 'types', categoryId, categoryName }

  if (!typeId || !typeName) return { level: 'categories' }
  if (level === 'subtypes') {
    return { level: 'subtypes', categoryId, categoryName, typeId, typeName }
  }

  if (!subtypeId || !subtypeName) return { level: 'categories' }
  const subtype = {
    level: 'subtype' as const,
    categoryId,
    categoryName,
    typeId,
    typeName,
    subtypeId,
    subtypeName,
  }
  const modelId = params.get('modelId')

  switch (level) {
    case 'subtype': {
      const tab: SubtypeTab =
        params.get('tab') === 'models' ? 'models' : 'components'
      return modelId ? { ...subtype, tab, modelId } : { ...subtype, tab }
    }
    case 'models':
      return { ...subtype, tab: 'models' }
    case 'instances':
      return modelId
        ? { ...subtype, tab: 'components', modelId }
        : { ...subtype, tab: 'components' }
    default:
      return { level: 'categories' }
  }
}

// Surfaces have no models: no models tab and no model filter.
export const withCategoryType = (
  state: ViewState,
  categoryType: CategoryType | undefined
): ViewState => {
  if (state.level !== 'subtype' || categoryType !== 'SURFACE') return state
  if (state.tab === 'components' && !state.modelId) return state
  const { modelId: _modelId, ...rest } = state
  return { ...rest, tab: 'components' }
}

export const toSearchParams = (state: ViewState): URLSearchParams => {
  const params = new URLSearchParams()
  if (state.level === 'categories') return params

  params.set('level', state.level)
  params.set('categoryId', state.categoryId)
  params.set('categoryName', state.categoryName)
  if (state.level === 'types') return params

  params.set('typeId', state.typeId)
  params.set('typeName', state.typeName)
  if (state.level === 'subtypes') return params

  params.set('subtypeId', state.subtypeId)
  params.set('subtypeName', state.subtypeName)
  if (state.tab === 'models') params.set('tab', 'models')
  if (state.modelId) params.set('modelId', state.modelId)
  return params
}

export const levelTitle = (state: ViewState): string => {
  switch (state.level) {
    case 'categories':
      return 'Komponentbibliotek'
    case 'types':
      return state.categoryName
    case 'subtypes':
      return state.typeName
    case 'subtype':
      return state.subtypeName
  }
}

export const levelSearch = (state: ViewState): string => {
  const params = toSearchParams(state).toString()
  return params ? `?${params}` : ''
}

// Identifies the view without its names, model filter or page.
export const toViewKey = (state: ViewState): string =>
  [
    state.level,
    state.level === 'categories' ? '' : state.categoryId,
    state.level === 'subtypes' || state.level === 'subtype' ? state.typeId : '',
    state.level === 'subtype' ? state.subtypeId : '',
    state.level === 'subtype' ? state.tab : '',
  ].join(':')

export const parentViewState = (state: ViewState): ViewState => {
  switch (state.level) {
    case 'categories':
    case 'types':
      return { level: 'categories' }
    case 'subtypes':
      return {
        level: 'types',
        categoryId: state.categoryId,
        categoryName: state.categoryName,
      }
    case 'subtype':
      return {
        level: 'subtypes',
        categoryId: state.categoryId,
        categoryName: state.categoryName,
        typeId: state.typeId,
        typeName: state.typeName,
      }
  }
}

export const ancestorViewStates = (state: ViewState): ViewState[] => {
  const ancestors: ViewState[] = []
  let current = state
  while (current.level !== 'categories') {
    current = parentViewState(current)
    ancestors.unshift(current)
  }
  return ancestors
}

export interface LibraryNames {
  categories?: Pick<ComponentCategory, 'id' | 'categoryName'>[]
  types?: Pick<ComponentType, 'id' | 'typeName'>[]
  subtypes?: Pick<ComponentSubtype, 'id' | 'subTypeName'>[]
}

// URL names go stale when the open node is renamed; ids never do.
export const withFreshNames = (
  state: ViewState,
  names: LibraryNames
): ViewState => {
  if (state.level === 'categories') return state

  const categoryName =
    names.categories?.find((c) => c.id === state.categoryId)?.categoryName ??
    state.categoryName
  if (state.level === 'types') return { ...state, categoryName }

  const typeName =
    names.types?.find((t) => t.id === state.typeId)?.typeName ?? state.typeName
  if (state.level === 'subtypes') return { ...state, categoryName, typeName }

  const subtypeName =
    names.subtypes?.find((s) => s.id === state.subtypeId)?.subTypeName ??
    state.subtypeName
  return { ...state, categoryName, typeName, subtypeName }
}
