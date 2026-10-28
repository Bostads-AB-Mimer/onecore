import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'

import type { ComponentPage } from '@/services/api/core/componentLibraryService'
import type { Component, ComponentModel } from '@/services/types'

import {
  formatComponentModelName,
  sortModelsByName,
} from '@/shared/lib/componentLabels'
import { Button } from '@/shared/ui/Button'
import { Pagination } from '@/shared/ui/Pagination'
import { SearchableSelect } from '@/shared/ui/SearchableSelect'
import { TableToolbar } from '@/shared/ui/TableToolbar'

import { type CategoryType, formatComponentPlace } from '../lib/componentRows'
import { COMPONENT_PAGE_SIZE, NO_MODEL } from '../lib/libraryUrlState'
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
  onPageChange: (page: number, options?: { replace?: boolean }) => void
  onModelFilterChange: (modelId: string | undefined) => void
  onClearFilters: () => void
  onCreate: () => void
  markedComponent: Component | undefined
  onUnmark: () => void
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
  markedComponent,
  onUnmark,
  ...rowHandlers
}: SubtypeComponentsTabProps) => {
  const totalPages = componentPage?.pagination.totalPages

  useEffect(() => {
    if (!isFetching && totalPages && page > totalPages) {
      onPageChange(totalPages, { replace: true })
    }
  }, [isFetching, totalPages, page, onPageChange])

  const filterOptions = useMemo(
    () => [
      { id: ALL_MODELS, label: 'Alla modeller' },
      { id: NO_MODEL, label: 'Utan modell' },
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

  const pageContent = componentPage?.content ?? []
  const pinMarked =
    page === 1 &&
    markedComponent !== undefined &&
    !pageContent.some((c) => c.id === markedComponent.id)
  const instances = pinMarked ? [markedComponent, ...pageContent] : pageContent

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
      {markedComponent && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-info/10 py-1.5 pl-4 pr-1.5 text-sm">
          <p className="min-w-0 flex-1 text-foreground">
            <span className="text-info">Markerad: </span>
            <span className="font-medium">
              {formatComponentPlace(markedComponent)}
            </span>
            {markedComponent.serialNumber && (
              <span className="whitespace-nowrap tabular-nums text-info">
                {' · SN '}
                {markedComponent.serialNumber}
              </span>
            )}
          </p>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-info hover:bg-info/15 hover:text-info"
              onClick={() => rowHandlers.onViewHistory(markedComponent)}
            >
              Visa detaljer
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-info hover:bg-info/15 hover:text-info"
              onClick={onUnmark}
              aria-label="Ta bort markeringen"
            >
              <X />
            </Button>
          </div>
        </div>
      )}
      {!isLoading && total === 0 ? (
        <NoResultsState onClear={onClearFilters} />
      ) : (
        <InstancesTable
          instances={instances}
          categoryType={categoryType}
          isLoading={isLoading}
          pageSize={Math.max(instances.length, COMPONENT_PAGE_SIZE)}
          hideModel={Boolean(modelId)}
          highlightedId={markedComponent?.id}
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
