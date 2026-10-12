import type { ComponentPage } from '@/services/api/core/componentLibraryService'
import type { Component, ComponentModel } from '@/services/types'

import { formatComponentModelName } from '@/shared/lib/componentLabels'
import { Pagination } from '@/shared/ui/Pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
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
  page: number
  searchInput: string
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  onModelFilterChange: (modelId: string | undefined) => void
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
  page,
  searchInput,
  onSearchChange,
  onPageChange,
  onModelFilterChange,
  onCreate,
  ...rowHandlers
}: SubtypeComponentsTabProps) => {
  if (error) {
    return (
      <ErrorState message="Kunde inte ladda komponenter. Försök igen senare." />
    )
  }

  const isEquipment = categoryType === 'EQUIPMENT'
  const isFiltered = Boolean(modelId) || searchInput.trim().length > 0
  const total = componentPage?.pagination.total

  if (!isLoading && total === 0 && !isFiltered) {
    return (
      <EmptyState
        title="Inga komponenter ännu"
        description="Skapa den första komponenten av den här undertypen"
        onAction={onCreate}
        actionLabel="Skapa komponent"
      />
    )
  }

  const modelFilter = isEquipment ? (
    <Select
      value={modelId ?? ALL_MODELS}
      onValueChange={(value) =>
        onModelFilterChange(value === ALL_MODELS ? undefined : value)
      }
    >
      <SelectTrigger className="h-10 w-64" aria-label="Filtrera på modell">
        <SelectValue placeholder="Alla modeller" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_MODELS}>Alla modeller</SelectItem>
        {modelOptions.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {formatComponentModelName(model)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : undefined

  return (
    <>
      <TableToolbar
        onAddNew={onCreate}
        addNewLabel="Ny komponent"
        itemCount={total}
        levelName="komponenter"
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
        <NoResultsState />
      ) : (
        <InstancesTable
          instances={componentPage?.content ?? []}
          categoryType={categoryType}
          isLoading={isLoading}
          pageSize={COMPONENT_PAGE_SIZE}
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
