import { useEffect, useMemo, useRef, useState } from 'react'

import { useComponentEntity, useSubtypeComponents } from '@/entities/component'

import type {
  Component,
  ComponentCategory,
  ComponentModel,
  ComponentSubtype,
  ComponentType,
} from '@/services/types'

import {
  useDialogState,
  type UseDialogStateReturn,
  useSimpleDialogState,
  type UseSimpleDialogStateReturn,
} from '@/shared/hooks'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useUrlPagination } from '@/shared/hooks/useUrlPagination'

import type { CategoryType } from '../lib/componentRows'
import {
  COMPONENT_PAGE_SIZE,
  isLegacyLibraryUrl,
  parseViewState,
  type SubtypeTab,
  toSearchParams,
  type ViewState,
} from '../lib/libraryUrlState'

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

// Stable reference: the instance dialog's fields are memoized on this list.
const NO_MODELS: ComponentModel[] = []

export const useComponentLibraryViewState = () => {
  const { searchParams, setSearchParams, updateUrlParams, page, setPage } =
    useUrlPagination({ defaultLimit: COMPONENT_PAGE_SIZE })

  const viewState = useMemo(() => parseViewState(searchParams), [searchParams])
  const subtypeState = viewState.level === 'subtype' ? viewState : undefined

  useEffect(() => {
    if (isLegacyLibraryUrl(searchParams)) {
      setSearchParams(toSearchParams(viewState), { replace: true })
    }
  }, [searchParams, setSearchParams, viewState])

  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  )

  useEffect(() => {
    setSearchInput(searchParams.get('search') || '')
  }, [searchParams])

  const debouncedSearch = useDebounce(searchInput, 300)
  const activeSearch =
    debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : undefined

  // Search resets on navigation, so skip the first run after a view change.
  const viewKey = `${viewState.level}:${subtypeState?.subtypeId ?? ''}:${subtypeState?.tab ?? ''}`
  const prevViewKeyRef = useRef(viewKey)

  useEffect(() => {
    if (prevViewKeyRef.current !== viewKey) {
      prevViewKeyRef.current = viewKey
      return
    }
    if (viewState.level !== 'subtypes' && viewState.level !== 'subtype') return

    const currentSearch = searchParams.get('search') || ''
    const newSearch = debouncedSearch.trim()
    if (currentSearch !== newSearch) {
      updateUrlParams(
        { search: newSearch || undefined, page: undefined },
        { replace: true }
      )
    }
  }, [debouncedSearch, viewKey, viewState.level, searchParams, updateUrlParams])

  const navigateTo = (newState: ViewState) => {
    setSearchParams(toSearchParams(newState))
    setSearchInput('')
  }

  const setTab = (tab: SubtypeTab) => {
    if (subtypeState) navigateTo({ ...subtypeState, tab })
  }

  const setModelFilter = (modelId: string | undefined) => {
    updateUrlParams({ modelId, page: undefined })
  }

  const dialogs: ComponentLibraryDialogStates = {
    categoryDialog: useDialogState<ComponentCategory>(),
    typeDialog: useDialogState<ComponentType>(),
    subtypeDialog: useDialogState<ComponentSubtype>(),
    modelDialog: useDialogState<ComponentModel>(),
    instanceDialog: useDialogState<Component>(),
    instanceDetailsDialog: useSimpleDialogState<Component>(),
    deinstallDialog: useSimpleDialogState<Component>(),
    imageGalleryDialog: useSimpleDialogState<Component>(),
  }

  const categories = useComponentEntity('category')

  const types = useComponentEntity(
    'type',
    viewState.level !== 'categories' ? viewState.categoryId : undefined
  )

  const subtypes = useComponentEntity(
    'subtype',
    viewState.level === 'subtypes' ? viewState.typeId : undefined,
    { search: viewState.level === 'subtypes' ? activeSearch : undefined }
  )

  // The database defaults a category's type to EQUIPMENT; undefined only while loading.
  const categoryType: CategoryType | undefined =
    viewState.level === 'categories' || !categories.data
      ? undefined
      : (categories.data.find((c) => c.id === viewState.categoryId)?.type ??
        'EQUIPMENT')

  const modelOptions = useComponentEntity(
    'model',
    subtypeState?.subtypeId,
    undefined,
    { enabled: subtypeState !== undefined }
  )

  const models = useComponentEntity(
    'model',
    subtypeState?.subtypeId,
    { search: subtypeState?.tab === 'models' ? activeSearch : undefined },
    { enabled: subtypeState?.tab === 'models' }
  )

  const componentPage = useSubtypeComponents(
    subtypeState?.tab === 'components'
      ? {
          subtypeId: subtypeState.subtypeId,
          modelId: subtypeState.modelId,
          search: activeSearch,
          page,
          limit: COMPONENT_PAGE_SIZE,
        }
      : undefined
  )

  return {
    viewState,
    navigateTo,
    setTab,
    setModelFilter,
    page,
    setPage,
    searchInput,
    setSearchInput,
    categoryType,
    dialogs,
    data: {
      categories: categories.data,
      categoriesLoading: categories.isLoading,
      categoriesError: categories.error,
      types: types.data,
      typesLoading: types.isLoading,
      typesError: types.error,
      subtypes: subtypes.data,
      subtypesLoading: subtypes.isLoading,
      subtypesError: subtypes.error,
      modelOptions: modelOptions.data ?? NO_MODELS,
      models: models.data,
      modelsLoading: models.isLoading,
      modelsError: models.error,
      componentPage: componentPage.data,
      componentsLoading: componentPage.isLoading,
      componentsFetching: componentPage.isFetching,
      componentsError: componentPage.error,
    },
  }
}

export type UseComponentLibraryViewStateReturn = ReturnType<
  typeof useComponentLibraryViewState
>
