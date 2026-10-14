import { useEffect, useMemo, useRef, useState } from 'react'
import { property } from '@onecore/types'
import { useQuery } from '@tanstack/react-query'

import {
  QUERY_KEY_ROOTS,
  useComponentEntity,
  useSubtypeComponents,
} from '@/entities/component'

import { componentLibraryService } from '@/services/api/core/componentLibraryService'
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
import type { SortControl, TableSort } from '@/shared/ui/dataTableSort'

import type { CategoryType } from '../lib/componentRows'
import {
  COMPONENT_PAGE_SIZE,
  type ComponentFilterControl,
  fallbackSortFor,
  isLegacyLibraryUrl,
  NO_MODEL,
  parseComponentFilters,
  parseSort,
  parseViewState,
  sortUrlParams,
  type SubtypeTab,
  toSearchParams,
  toViewKey,
  type ViewState,
  withCategoryType,
  withFreshNames,
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

  const urlViewState = useMemo(
    () => parseViewState(searchParams),
    [searchParams]
  )

  // Read from the URL, which receives the search and the page reset together.
  const urlSearch = searchParams.get('search')?.trim() ?? ''
  const activeSearch = urlSearch.length >= 2 ? urlSearch : undefined

  const categories = useComponentEntity('category')

  const types = useComponentEntity(
    'type',
    urlViewState.level !== 'categories' ? urlViewState.categoryId : undefined
  )

  const onSubtypeLevel =
    urlViewState.level === 'subtypes' || urlViewState.level === 'subtype'
  const subtypes = useComponentEntity(
    'subtype',
    onSubtypeLevel ? urlViewState.typeId : undefined,
    { search: urlViewState.level === 'subtypes' ? activeSearch : undefined },
    { enabled: onSubtypeLevel }
  )

  // The database defaults a category's type to EQUIPMENT; undefined only while loading.
  const categoryType: CategoryType | undefined =
    urlViewState.level === 'categories' || !categories.data
      ? undefined
      : (categories.data.find((c) => c.id === urlViewState.categoryId)?.type ??
        'EQUIPMENT')

  const viewState = useMemo(
    () =>
      withFreshNames(withCategoryType(urlViewState, categoryType), {
        categories: categories.data,
        types: types.data,
        subtypes: subtypes.data,
      }),
    [urlViewState, categoryType, categories.data, types.data, subtypes.data]
  )
  const subtypeState = viewState.level === 'subtype' ? viewState : undefined

  useEffect(() => {
    if (isLegacyLibraryUrl(searchParams)) {
      setSearchParams(toSearchParams(urlViewState), { replace: true })
    }
  }, [searchParams, setSearchParams, urlViewState])

  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  )

  useEffect(() => {
    setSearchInput(searchParams.get('search') || '')
  }, [searchParams])

  const debouncedSearch = useDebounce(searchInput, 300)

  // Search resets on navigation, so skip the first run after a view change.
  const viewKey = toViewKey(viewState)
  const prevViewKeyRef = useRef(viewKey)

  useEffect(() => {
    if (prevViewKeyRef.current !== viewKey) {
      prevViewKeyRef.current = viewKey
      return
    }
    if (viewState.level !== 'subtypes' && viewState.level !== 'subtype') return
    if (debouncedSearch !== searchInput) return

    const currentSearch = searchParams.get('search') || ''
    const newSearch = debouncedSearch.trim()
    if (currentSearch !== newSearch) {
      updateUrlParams(
        { search: newSearch || undefined, page: undefined },
        { replace: true }
      )
    }
  }, [
    debouncedSearch,
    searchInput,
    viewKey,
    viewState.level,
    searchParams,
    updateUrlParams,
  ])

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

  const clearFilters = () => {
    updateUrlParams({
      modelId: undefined,
      search: undefined,
      installation: undefined,
      installedBefore: undefined,
      page: undefined,
    })
    setSearchInput('')
  }

  const onComponentList = subtypeState?.tab === 'components'
  const fallbackSort = fallbackSortFor(viewState)
  const sort: SortControl = {
    value:
      parseSort(
        searchParams,
        onComponentList ? property.ComponentSortKeySchema.options : undefined
      ) ?? fallbackSort,
    fallback: fallbackSort,
    onChange: (next: TableSort) =>
      updateUrlParams({
        ...sortUrlParams(next, fallbackSort),
        page: undefined,
      }),
  }

  const componentFilterValue = useMemo(
    () => parseComponentFilters(searchParams),
    [searchParams]
  )
  const componentFilters: ComponentFilterControl = {
    value: componentFilterValue,
    onInstallationChange: (installation) =>
      updateUrlParams({
        installation,
        ...(installation === 'notInstalled'
          ? { installedBefore: undefined }
          : {}),
        page: undefined,
      }),
    onInstalledBeforeChange: (year) =>
      updateUrlParams({ installedBefore: year, page: undefined }),
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

  const modelOptions = useComponentEntity(
    'model',
    subtypeState?.subtypeId,
    undefined,
    { enabled: subtypeState !== undefined && categoryType === 'EQUIPMENT' }
  )

  const models = useComponentEntity(
    'model',
    subtypeState?.subtypeId,
    { search: subtypeState?.tab === 'models' ? activeSearch : undefined },
    { enabled: subtypeState?.tab === 'models' }
  )

  const componentPage = useSubtypeComponents(
    subtypeState?.tab === 'components' && categoryType
      ? {
          subtypeId: subtypeState.subtypeId,
          modelId:
            subtypeState.modelId === NO_MODEL
              ? undefined
              : subtypeState.modelId,
          withoutModel: subtypeState.modelId === NO_MODEL,
          search: activeSearch,
          searchField:
            categoryType === 'SURFACE' ? 'specifications' : 'serialNumber',
          ...componentFilterValue,
          sort: sort.value,
          page,
          limit: COMPONENT_PAGE_SIZE,
        }
      : undefined
  )

  const markedComponentId =
    subtypeState?.tab === 'components'
      ? (searchParams.get('componentId') ?? undefined)
      : undefined
  const markedComponent = useQuery({
    queryKey: [QUERY_KEY_ROOTS.instance, 'by-id', markedComponentId],
    queryFn: () => componentLibraryService.getInstanceById(markedComponentId!),
    enabled: markedComponentId !== undefined,
  })

  const unmarkComponent = () => {
    updateUrlParams({ componentId: undefined }, { replace: true })
  }

  return {
    viewState,
    markedComponent:
      markedComponentId && !markedComponent.isError
        ? markedComponent.data
        : undefined,
    unmarkComponent,
    navigateTo,
    setTab,
    setModelFilter,
    clearFilters,
    sort,
    componentFilters,
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
      refetchCategories: () => void categories.refetch(),
      types: types.data,
      typesLoading: types.isLoading,
      typesError: types.error,
      refetchTypes: () => void types.refetch(),
      subtypes: subtypes.data,
      subtypesLoading: subtypes.isLoading,
      subtypesError: subtypes.error,
      refetchSubtypes: () => void subtypes.refetch(),
      modelOptions: modelOptions.data ?? NO_MODELS,
      models: models.data,
      modelsLoading: models.isLoading,
      modelsError: models.error,
      refetchModels: () => void models.refetch(),
      componentPage: componentPage.data,
      componentsLoading: componentPage.isLoading,
      componentsFetching: componentPage.isFetching,
      componentsError: componentPage.error,
      refetchComponents: () => void componentPage.refetch(),
    },
  }
}

export type UseComponentLibraryViewStateReturn = ReturnType<
  typeof useComponentLibraryViewState
>
