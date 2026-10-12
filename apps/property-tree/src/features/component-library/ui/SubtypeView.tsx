import type { ComponentPage } from '@/services/api/core/componentLibraryService'
import type { Component, ComponentModel } from '@/services/types'

import { TableToolbar } from '@/shared/ui/TableToolbar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

import type { CategoryType } from '../lib/componentRows'
import type { SubtypeTab, SubtypeViewState } from '../lib/libraryUrlState'
import {
  EmptyState,
  ErrorState,
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

  if (!categoryType) {
    return <p className="py-10 text-center text-muted-foreground">Laddar...</p>
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
    <ErrorState message="Kunde inte ladda modeller. Försök igen senare." />
  ) : !modelsLoading && (!models || models.length === 0) && !hasActiveSearch ? (
    <EmptyState
      title="Inga modeller ännu"
      description="Skapa din första modell för att komma igång"
      onAction={props.onCreateModel}
      actionLabel="Skapa modell"
    />
  ) : (
    <>
      <TableToolbar
        onAddNew={props.onCreateModel}
        addNewLabel="Ny modell"
        itemCount={models?.length}
        levelName="modeller"
        searchValue={searchInput}
        onSearchChange={onSearchChange}
        searchPlaceholder="Sök efter modell eller tillverkare..."
      />
      {!modelsLoading && models?.length === 0 && hasActiveSearch ? (
        <NoResultsState />
      ) : (
        <ModelsTable
          models={models || []}
          isLoading={modelsLoading}
          onEdit={props.onEditModel}
          onDelete={props.onDeleteModel}
          onNavigate={props.onOpenModelComponents}
          onCreateInstance={props.onCreateInstance}
        />
      )}
    </>
  )

  return (
    <Tabs
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
