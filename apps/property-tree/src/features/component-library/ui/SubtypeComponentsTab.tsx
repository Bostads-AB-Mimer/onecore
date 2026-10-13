import { useEffect, useMemo } from 'react'

import type { ComponentPage } from '@/services/api/core/componentLibraryService'
import type { Component, ComponentModel } from '@/services/types'

import {
  formatComponentModelName,
  sortModelsByName,
} from '@/shared/lib/componentLabels'
import { Pagination } from '@/shared/ui/Pagination'
import { SearchableSelect } from '@/shared/ui/SearchableSelect'
import { TableToolbar } from '@/shared/ui/TableToolbar'

import type { CategoryType } from '../lib/componentRows'
import { COMPONENT_PAGE_SIZE } from '../lib/libraryUrlState'
import {
  EmptyState,
  ErrorState,
  NoResultsState,
} from './ComponentLibraryContent'
import { InstancesTable } from './InstancesTable'

const ALL_MODELS = 'all'

interface SubtypeComponentsTabProps {
  categoryType: CategoryType
  modelId: string | undefined
  modelOptions: ComponentModel[]
  componentPage: ComponentPage | undefined
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  onRetry: () => void
  page: number
  searchInput: string
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  onModelFilterChange: (modelId: string | undefined) => void
  onClearFilters: () => void
  onCreate: () => void
  onEdit: (instance: Component) => void
  onDelete: (instance: Component) => void
  onViewHistory: (instance: Component) => void
  onUninstall: (instance: Component) => void
  onViewImages: (instance: Component) => void
}

export const SubtypeComponentsTab = ({
  categoryType,
  modelId,
  modelOptions,
  componentPage,
  isLoading,
  isFetching,
  error,
  onRetry,
  page,
  searchInput,
  onSearchChange,
  onPageChange,
  onModelFilterChange,
  onClearFilters,
  onCreate,
  ...rowHandlers
}: SubtypeComponentsTabProps) => {
  const totalPages = componentPage?.pagination.totalPages

  useEffect(() => {
    if (!isFetching && totalPages && page > totalPages) {
      onPageChange(totalPages)
    }
  }, [isFetching, totalPages, page, onPageChange])

  const filterOptions = useMemo(
    () => [
      { id: ALL_MODELS, label: 'Alla modeller' },
      ...sortModelsByName(modelOptions).map((model) => ({
        id: model.id,
        label: formatComponentModelName(model),
      })),
    ],
    [modelOptions]
  )

  if (error) {
    return (
      <ErrorState message="Kunde inte ladda komponenterna" onRetry={onRetry} />
    )
  }

  const isEquipment = categoryType === 'EQUIPMENT'
  const isFiltered = Boolean(modelId) || searchInput.trim().length > 0
  const total = componentPage?.pagination.total

  if (!isLoading && total === 0 && !isFiltered) {
    return (
      <EmptyState
        title="Inga komponenter av den här undertypen"
        description="Komponenter läggs till här eller när de installeras i en lägenhet."
        onAction={onCreate}
        actionLabel="Skapa komponent"
      />
    )
  }

  const modelFilter = isEquipment ? (
    <div className="w-full sm:w-72">
      <label htmlFor="model-filter" className="sr-only">
        Filtrera på modell
      </label>
      <SearchableSelect
        id="model-filter"
        items={filterOptions}
        value={
          filterOptions.find((o) => o.id === (modelId ?? ALL_MODELS)) ?? null
        }
        onChange={(option) =>
          onModelFilterChange(option.id === ALL_MODELS ? undefined : option.id)
        }
        getKey={(option) => option.id}
        getLabel={(option) => option.label}
        placeholder="Alla modeller"
        searchPlaceholder="Sök modell..."
        emptyText="Ingen modell matchar"
        className="h-10"
      />
    </div>
  ) : undefined

  return (
    <>
      <TableToolbar
        itemCount={total}
        levelName="komponenter"
        levelNameSingular="komponent"
        filters={modelFilter}
        {...(isEquipment
          ? {
              searchValue: searchInput,
              onSearchChange,
              searchPlaceholder: 'Sök efter serienummer...',
            }
          : {})}
      />
      {!isLoading && total === 0 ? (
        <NoResultsState onClear={onClearFilters} />
      ) : (
        <InstancesTable
          instances={componentPage?.content ?? []}
          categoryType={categoryType}
          isLoading={isLoading}
          pageSize={COMPONENT_PAGE_SIZE}
          hideModel={Boolean(modelId)}
          {...rowHandlers}
        />
      )}
      {componentPage && (
        <Pagination
          currentPage={page}
          totalPages={componentPage.pagination.totalPages}
          totalRecords={componentPage.pagination.total}
          pageSize={COMPONENT_PAGE_SIZE}
          onPageChange={onPageChange}
          isFetching={isFetching}
        />
      )}
    </>
  )
}
