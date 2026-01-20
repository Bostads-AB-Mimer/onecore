import { useState, useEffect, useMemo } from 'react'
import { useUrlPagination } from '@/components/hooks/useUrlPagination'
import { useDebounce } from '@/components/hooks/useDebounce'
import { useComponentEntity } from '@/components/hooks/useComponentEntity'
import {
  useDialogState,
  useSimpleDialogState,
  type UseDialogStateReturn,
  type UseSimpleDialogStateReturn,
} from '@/components/hooks/useDialogState'
import type { ViewState } from '@/components/hooks/useComponentLibraryHandlers'
import type {
  ComponentCategory,
  ComponentType,
  ComponentSubtype,
  ComponentModel,
  Component,
} from '@/services/types'

// Re-export ViewState for convenience
export type { ViewState } from '@/components/hooks/useComponentLibraryHandlers'

// Helper function to derive ViewState from URL search params
function deriveViewStateFromParams(searchParams: URLSearchParams): ViewState {
  const level = searchParams.get('level') || 'categories'

  if (level === 'types') {
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')
    if (categoryId && categoryName) {
      return { level: 'types', categoryId, categoryName }
    }
  }

  if (level === 'subtypes') {
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')
    const typeId = searchParams.get('typeId')
    const typeName = searchParams.get('typeName')
    if (categoryId && categoryName && typeId && typeName) {
      return { level: 'subtypes', categoryId, categoryName, typeId, typeName }
    }
  }

  if (level === 'models') {
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')
    const typeId = searchParams.get('typeId')
    const typeName = searchParams.get('typeName')
    const subtypeId = searchParams.get('subtypeId')
    const subtypeName = searchParams.get('subtypeName')
    if (
      categoryId &&
      categoryName &&
      typeId &&
      typeName &&
      subtypeId &&
      subtypeName
    ) {
      return {
        level: 'models',
        categoryId,
        categoryName,
        typeId,
        typeName,
        subtypeId,
        subtypeName,
      }
    }
  }

  if (level === 'instances') {
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')
    const typeId = searchParams.get('typeId')
    const typeName = searchParams.get('typeName')
    const subtypeId = searchParams.get('subtypeId')
    const subtypeName = searchParams.get('subtypeName')
    const modelId = searchParams.get('modelId')
    const modelName = searchParams.get('modelName')
    if (
      categoryId &&
      categoryName &&
      typeId &&
      typeName &&
      subtypeId &&
      subtypeName &&
      modelId &&
      modelName
    ) {
      return {
        level: 'instances',
        categoryId,
        categoryName,
        typeId,
        typeName,
        subtypeId,
        subtypeName,
        modelId,
        modelName,
      }
    }
  }

  // Default to categories
  return { level: 'categories' }
}

// Helper function to create URL params from ViewState
function createParamsFromViewState(state: ViewState): URLSearchParams {
  const params = new URLSearchParams()

  if (state.level === 'categories') {
    // No params needed for categories
    return params
  }

  params.set('level', state.level)
  params.set('categoryId', state.categoryId)
  params.set('categoryName', state.categoryName)

  if (
    state.level === 'subtypes' ||
    state.level === 'models' ||
    state.level === 'instances'
  ) {
    params.set('typeId', state.typeId)
    params.set('typeName', state.typeName)
  }

  if (state.level === 'models' || state.level === 'instances') {
    params.set('subtypeId', state.subtypeId)
    params.set('subtypeName', state.subtypeName)
  }

  if (state.level === 'instances') {
    params.set('modelId', state.modelId)
    params.set('modelName', state.modelName)
  }

  return params
}

export interface ComponentLibraryDialogStates {
  categoryDialog: UseDialogStateReturn<ComponentCategory>
  typeDialog: UseDialogStateReturn<ComponentType>
  subtypeDialog: UseDialogStateReturn<ComponentSubtype>
  modelDialog: UseDialogStateReturn<ComponentModel>
  instanceDialog: UseDialogStateReturn<Component>
  instanceDetailsDialog: UseSimpleDialogStateReturn<Component>
  deinstallDialog: UseSimpleDialogStateReturn<Component>
  imageGalleryDialog: UseSimpleDialogStateReturn<Component>
}

export interface ComponentLibraryDataState {
  categories: ComponentCategory[] | undefined
  categoriesLoading: boolean
  categoriesError: Error | null
  types: ComponentType[] | undefined
  typesLoading: boolean
  typesError: Error | null
  subtypes: ComponentSubtype[] | undefined
  subtypesLoading: boolean
  subtypesError: Error | null
  models: ComponentModel[] | undefined
  modelsLoading: boolean
  modelsError: Error | null
  instances: Component[] | undefined
  instancesLoading: boolean
  instancesError: Error | null
}

export interface UseComponentLibraryViewStateReturn {
  // View state
  viewState: ViewState
  navigateTo: (newState: ViewState) => void

  // Search state
  searchInput: string
  setSearchInput: (value: string) => void
  debouncedSearch: string

  // Dialog states
  dialogs: ComponentLibraryDialogStates

  // Data state
  data: ComponentLibraryDataState
}

export function useComponentLibraryViewState(): UseComponentLibraryViewStateReturn {
  const { searchParams, setSearchParams, updateUrlParams } = useUrlPagination()

  // Derive viewState from URL params
  const viewState = useMemo(
    () => deriveViewStateFromParams(searchParams),
    [searchParams]
  )

  // Local search input state for immediate feedback
  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  )

  // Sync search input when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    setSearchInput(urlSearch)
  }, [searchParams])

  // Debounced search for API calls
  const debouncedSearch = useDebounce(searchInput, 300)

  // Update URL when debounced search changes (only for levels that support search)
  useEffect(() => {
    if (
      viewState.level === 'subtypes' ||
      viewState.level === 'models' ||
      viewState.level === 'instances'
    ) {
      const currentSearch = searchParams.get('search') || ''
      const newSearch = debouncedSearch.trim()

      if (currentSearch !== newSearch) {
        updateUrlParams({ search: newSearch || undefined }, { replace: true })
      }
    }
  }, [debouncedSearch, viewState, searchParams, updateUrlParams])

  // Navigation helper that updates URL (replaces all params for level changes)
  const navigateTo = (newState: ViewState) => {
    const params = createParamsFromViewState(newState)
    setSearchParams(params)
    setSearchInput('') // Reset search when navigating
  }

  // Dialog states
  const categoryDialog = useDialogState<ComponentCategory>()
  const typeDialog = useDialogState<ComponentType>()
  const subtypeDialog = useDialogState<ComponentSubtype>()
  const modelDialog = useDialogState<ComponentModel>()
  const instanceDialog = useDialogState<Component>()

  const instanceDetailsDialog = useSimpleDialogState<Component>()
  const deinstallDialog = useSimpleDialogState<Component>()
  const imageGalleryDialog = useSimpleDialogState<Component>()

  // Data fetching
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useComponentEntity('category')

  const {
    data: types,
    isLoading: typesLoading,
    error: typesError,
  } = useComponentEntity(
    'type',
    viewState.level !== 'categories' ? viewState.categoryId : undefined
  )

  const {
    data: subtypes,
    isLoading: subtypesLoading,
    error: subtypesError,
  } = useComponentEntity(
    'subtype',
    viewState.level === 'subtypes' || viewState.level === 'models'
      ? viewState.typeId
      : undefined,
    {
      search:
        viewState.level === 'subtypes' && debouncedSearch.trim().length >= 2
          ? debouncedSearch
          : undefined,
    }
  )

  const {
    data: models,
    isLoading: modelsLoading,
    error: modelsError,
  } = useComponentEntity(
    'model',
    viewState.level === 'models' ? viewState.subtypeId : undefined,
    {
      search:
        viewState.level === 'models' && debouncedSearch.trim().length >= 2
          ? debouncedSearch
          : undefined,
    }
  )

  const {
    data: instances,
    isLoading: instancesLoading,
    error: instancesError,
  } = useComponentEntity(
    'instance',
    viewState.level === 'instances' ? viewState.modelId : undefined,
    {
      search:
        viewState.level === 'instances' && debouncedSearch.trim().length >= 2
          ? debouncedSearch
          : undefined,
    }
  )

  return {
    viewState,
    navigateTo,
    searchInput,
    setSearchInput,
    debouncedSearch,
    dialogs: {
      categoryDialog,
      typeDialog,
      subtypeDialog,
      modelDialog,
      instanceDialog,
      instanceDetailsDialog,
      deinstallDialog,
      imageGalleryDialog,
    },
    data: {
      categories,
      categoriesLoading,
      categoriesError,
      types,
      typesLoading,
      typesError,
      subtypes,
      subtypesLoading,
      subtypesError,
      models,
      modelsLoading,
      modelsError,
      instances,
      instancesLoading,
      instancesError,
    },
  }
}
