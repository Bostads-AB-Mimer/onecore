import type { ComponentPage } from '@/services/api/core/componentLibraryService'
import type { Component, ComponentModel } from '@/services/types'

import { TableToolbar } from '@/shared/ui/TableToolbar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import type { CategoryType } from '../lib/componentRows'
import {
  levelSearch,
  type SubtypeTab,
  type SubtypeViewState,
} from '../lib/libraryUrlState'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  NoResultsState,
} from './ComponentLibraryContent'
import { ModelsTable } from './ModelsTable'
import { SubtypeComponentsTab } from './SubtypeComponentsTab'

interface SubtypeViewProps {
  viewState: SubtypeViewState
  categoryType: CategoryType | undefined
  searchInput: string
  onSearchChange: (value: string) => void
  onTabChange: (tab: SubtypeTab) => void
  // Modeller
  models: ComponentModel[] | undefined
  modelsLoading: boolean
  modelsError: Error | null
  onRetryModels: () => void
  onCreateModel: () => void
  onEditModel: (model: ComponentModel) => void
  onDeleteModel: (model: ComponentModel) => void
  onCreateInstance: (model: ComponentModel) => void
  onOpenModelComponents: (model: ComponentModel) => void
  // Komponenter
  modelOptions: ComponentModel[]
  componentPage: ComponentPage | undefined
  componentsLoading: boolean
  componentsFetching: boolean
  componentsError: Error | null
  onRetryComponents: () => void
  categoryError: Error | null
  onRetryCategory: () => void
  page: number
  onPageChange: (page: number) => void
  onModelFilterChange: (modelId: string | undefined) => void
  onCreateComponent: () => void
  onEditInstance: (instance: Component) => void
  onDeleteInstance: (instance: Component) => void
  onViewHistory: (instance: Component) => void
  onUninstall: (instance: Component) => void
  onViewImages: (instance: Component) => void
}

export const SubtypeView = (props: SubtypeViewProps) => {
  const { viewState, categoryType, searchInput, onSearchChange } = props

  if (props.categoryError) {
    return (
      <ErrorState
        message="Kunde inte ladda kategorin"
        onRetry={props.onRetryCategory}
      />
    )
  }

  if (!categoryType) {
    return <LoadingRows />
  }

  const componentsTab = (
    <SubtypeComponentsTab
      categoryType={categoryType}
      modelId={viewState.modelId}
      modelOptions={props.modelOptions}
      componentPage={props.componentPage}
      isLoading={props.componentsLoading}
      isFetching={props.componentsFetching}
      error={props.componentsError}
      onRetry={props.onRetryComponents}
      page={props.page}
      searchInput={searchInput}
      onSearchChange={onSearchChange}
      onPageChange={props.onPageChange}
      onModelFilterChange={props.onModelFilterChange}
      onCreate={props.onCreateComponent}
      onEdit={props.onEditInstance}
      onDelete={props.onDeleteInstance}
      onViewHistory={props.onViewHistory}
      onUninstall={props.onUninstall}
      onViewImages={props.onViewImages}
    />
  )

  // Surfaces take no model, so they get the component list alone.
  if (categoryType === 'SURFACE') return componentsTab

  const hasActiveSearch = searchInput.trim().length > 0
  const { models, modelsLoading, modelsError } = props

  const modelsTab = modelsError ? (
    <ErrorState
      message="Kunde inte ladda modellerna"
      onRetry={props.onRetryModels}
    />
  ) : !modelsLoading && (!models || models.length === 0) && !hasActiveSearch ? (
    <EmptyState
      title="Inga modeller för den här undertypen"
      description="Komponenter kan registreras utan modell. Lägg till en modell när tillverkare och modellbeteckning är kända."
      onAction={props.onCreateModel}
      actionLabel="Skapa modell"
    />
  ) : (
    <>
      <TableToolbar
        itemCount={models?.length}
        levelName="modeller"
        levelNameSingular="modell"
        searchValue={searchInput}
        onSearchChange={onSearchChange}
        searchPlaceholder="Sök efter modell eller tillverkare..."
      />
      {!modelsLoading && models?.length === 0 && hasActiveSearch ? (
        <NoResultsState onClear={() => onSearchChange('')} />
      ) : (
        <ModelsTable
          models={models || []}
          isLoading={modelsLoading}
          onEdit={props.onEditModel}
          onDelete={props.onDeleteModel}
          onNavigate={props.onOpenModelComponents}
          onCreateInstance={props.onCreateInstance}
          getHref={(model) =>
            levelSearch({ ...viewState, tab: 'components', modelId: model.id })
          }
        />
      )}
    </>
  )

  return (
    <Tabs
      className="mt-4"
      value={viewState.tab}
      onValueChange={(value) => props.onTabChange(value as SubtypeTab)}
    >
      <TabsList>
        <TabsTrigger value="components">Komponenter</TabsTrigger>
        <TabsTrigger value="models">Modeller</TabsTrigger>
      </TabsList>
      <TabsContent value="components">{componentsTab}</TabsContent>
      <TabsContent value="models">{modelsTab}</TabsContent>
    </Tabs>
  )
}
