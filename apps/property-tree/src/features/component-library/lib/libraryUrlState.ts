export const COMPONENT_PAGE_SIZE = 25

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

export function parseViewState(params: URLSearchParams): ViewState {
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

export function toSearchParams(state: ViewState): URLSearchParams {
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
